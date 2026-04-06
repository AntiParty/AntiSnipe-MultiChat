import log from 'electron-log'
import { net } from 'electron'
import { TwitchService } from './twitch/TwitchService'
import { youtubeService } from './youtube/YouTubeService'
import { KickService } from './kick/KickService'
import { TikTokService } from './tiktok/TikTokService'
import { broadcaster } from '../ipc/broadcaster'
import { settingsStore } from '../store/SettingsStore'
import { emoteCacheManager } from '../emotes/EmoteCacheManager'
import { tokenStore } from '../auth/TokenStore'
import { twitchAuth } from '../auth/TwitchAuth'
import { buildSelfMessage, buildSystemMessage, normalizeTwitchMessage } from './twitch/TwitchMessageNormalizer'
import { parseIrcLine } from './twitch/TwitchIrcParser'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import { TWITCH_HELIX_BASE } from '../../shared/constants'
import { pluginManager } from './PluginManager'
import type { ConnectChannelPayload, ConnectionState } from '../../shared/types/channel'
import type { NormalizedMessage, DeleteMessageEvent } from '../../shared/types/message'
import type { ModActionPayload, ModActionType, UserCardPayload, UserCardData } from '../../shared/types/ipc'

// Twitch removed these commands from IRC in Feb 2023 — must use Helix API instead
const REMOVED_IRC_COMMANDS: Record<string, ModActionType | 'unban'> = {
  '/ban':      'ban',
  '/timeout':  'timeout',
  '/unban':    'unban',
  '/untimeout':'unban'
}

class PlatformManager {
  private connectionStates = new Map<string, ConnectionState>()
  private recentMessageCache = new Map<string, NormalizedMessage[]>()
  private twitchService: TwitchService
  private kickService: KickService
  private tiktokService: TikTokService

  constructor() {
    this.tiktokService = new TikTokService(
      msg => this.handleMessage(msg),
      (channelId, status, error) => this.setConnectionState(channelId, status, error)
    )

    this.twitchService = new TwitchService(
      msg => this.handleMessage(msg),
      event => this.handleDelete(event),
      (_status, _error) => {},
      (channelId, roomId) => {
        // ROOMSTATE gives us the broadcaster's numeric user ID for free — use it for emotes
        emoteCacheManager.fetchForChannel({ channelId, twitchUserId: roomId }).catch(log.error)
      },
      (channelId, isMod) => {
        broadcaster.send(RENDERER_CHANNELS.SELF_MOD_STATUS, { channelId, isMod })
      }
    )

    this.kickService = new KickService(
      msg => this.handleMessage(msg),
      (channelId, status, error) => this.setConnectionState(channelId, status, error)
    )
  }

  private handleMessage(msg: NormalizedMessage): void {
    const action = pluginManager.applyToMessage(msg)
    if (action?.type === 'hide') return
    if (action?.type === 'command') {
      // Bot-style: plugin intercepts an incoming message and sends a response
      let respond = action.respond
      if (respond === '__song__') {
        try {
          const { execSync } = require('child_process') as typeof import('child_process')
          if (process.platform === 'win32') {
            const out = execSync(
              'powershell -Command ' +
              '"$ErrorActionPreference = \'SilentlyContinue\'; ' +
              '$spotify = (Get-Process -Name Spotify -ErrorAction SilentlyContinue).MainWindowTitle; ' +
              'if ($spotify) { $song = $spotify -replace \'^Spotify ?- ?\'; if ($song -ne \'\') { $song } }"',
              { timeout: 3000, encoding: 'utf8' }
            ).trim()
            respond = out || '(nothing playing)'
          } else {
            respond = '(not supported on this OS)'
          }
        } catch {
          respond = '(error fetching song)'
        }
      }
      const settings = settingsStore.get()
      if (settings.pluginMentionUsers) {
        respond = `@${msg.authorDisplayName} ${respond}`
      }
      this.sendMessage(msg.channelId, respond).catch(err => log.error('Plugin command send failed:', err))
      // Fall through — still show the original message in chat
    } else if (action) {
      // highlight / tag / replace — bake into message for renderer
      msg.pluginAction = action
    }
    broadcaster.enqueue(msg)
  }

  private handleDelete(event: DeleteMessageEvent): void {
    broadcaster.send(RENDERER_CHANNELS.DELETE_MESSAGE, event)
  }

  private sendSystemMessage(channelId: string, displayName: string, text: string): void {
    const msg = buildSystemMessage(channelId, displayName, text)
    broadcaster.enqueue(msg)
  }

  private setConnectionState(channelId: string, status: ConnectionState['status'], error?: string): void {
    const state: ConnectionState = { channelId, status, error }
    this.connectionStates.set(channelId, state)
    broadcaster.send(RENDERER_CHANNELS.CONNECTION_STATE, state)
  }

  async connect(payload: ConnectChannelPayload): Promise<void> {
    const { channelId, platform, slug } = payload
    const settings = settingsStore.get()
    const channelConfig = settings.channels.find(c => c.id === channelId)
    const displayName = channelConfig?.displayName || slug

    this.setConnectionState(channelId, 'connecting')

    try {
      if (platform === 'twitch') {
        const twitchToken = tokenStore.getAccessToken('twitch')
        if (!twitchToken && !(settings.twitchClientId && settings.twitchClientSecret)) {
          this.setConnectionState(channelId, 'error', 'Authentication required')
          this.sendSystemMessage(channelId, displayName,
            '⚠ Twitch authentication required — please log in via Settings → Auth')
          return
        }

        // broadcasterId and emote fetch happen automatically via ROOMSTATE after join
        await this.twitchService.joinChannel({ channelId, slug, displayName })
        this.setConnectionState(channelId, 'connected')

        // Chatterino-style connected message
        this.sendSystemMessage(channelId, displayName, `Connected to #${slug}`)

        if (settings.loadRecentMessages) {
          this.fetchRecentMessages(channelId, slug, displayName).catch(log.warn)
        }
      } else if (platform === 'youtube') {
        await youtubeService.joinChannel(
          channelId,
          slug,
          displayName,
          msgs => msgs.forEach(m => this.handleMessage(m)),
          (cId, status, error) => this.setConnectionState(cId, status, error)
        )
        // Emotes for YouTube (no Twitch user ID, use channel name)
        emoteCacheManager.fetchForChannel({ channelId }).catch(log.error)
      } else if (platform === 'kick') {
        emoteCacheManager.fetchForChannel({
          channelId,
          kickUserId: slug
        }).catch(log.error)

        await this.kickService.joinChannel(channelId, slug, displayName)
      } else if (platform === 'tiktok') {
        await this.tiktokService.joinChannel(channelId, slug, displayName)
      }
    } catch (err) {
      log.error(`Failed to connect to ${platform}:${slug}:`, err)
      this.setConnectionState(channelId, 'error', String(err))
    }
  }

  async disconnect(channelId: string): Promise<void> {
    const state = this.connectionStates.get(channelId)
    if (!state) return

    const settings = settingsStore.get()
    const channel = settings.channels.find(c => c.id === channelId)
    if (!channel) return

    if (channel.platform === 'twitch') {
      this.twitchService.leaveChannel(channelId)
    } else if (channel.platform === 'youtube') {
      youtubeService.leaveChannel(channelId)
    } else if (channel.platform === 'kick') {
      this.kickService.leaveChannel(channelId)
    } else if (channel.platform === 'tiktok') {
      this.tiktokService.leaveChannel(channelId)
    }

    this.setConnectionState(channelId, 'disconnected')
  }

  disconnectAll(): void {
    this.twitchService.disconnect()
    youtubeService.disconnectAll()
    this.kickService.disconnectAll()
    this.tiktokService.disconnectAll()
    for (const channelId of this.connectionStates.keys()) {
      this.setConnectionState(channelId, 'disconnected')
    }
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    const settings = settingsStore.get()
    const channel = settings.channels.find(c => c.id === channelId)
    if (!channel) throw new Error(`Channel ${channelId} not found in settings`)

    if (channel.platform === 'twitch') {
      // Check if this is a removed IRC command that must go through the Helix API
      if (text.startsWith('/')) {
        const parts = text.trim().split(/\s+/)
        const cmd = parts[0].toLowerCase()
        const action = REMOVED_IRC_COMMANDS[cmd]
        if (action) {
          const targetLogin = parts[1]
          if (!targetLogin) return // malformed command, silently ignore
          await this.executeTwitchModCommand(channelId, action as ModActionType, targetLogin, parts)
          return
        }
        // All other /commands (e.g. /me, /color, /slow) pass through IRC normally
        this.twitchService.sendMessage(channelId, text)
        return
      }

      this.twitchService.sendMessage(channelId, text)
      // Optimistic injection — show the message immediately without waiting for IRC echo
      const { username, userId } = tokenStore.getUserInfo('twitch')
      if (username && userId) {
        const selfMsg = buildSelfMessage(
          channelId,
          channel.displayName,
          text,
          username,
          userId,
          settings.mentionKeywords,
          settings.keywordAlerts,
          this.twitchService.getSelfBadgeTag(channelId),
          this.twitchService.getBroadcasterId(channelId)
        )
        broadcaster.enqueue(selfMsg)
      }
    } else if (channel.platform === 'youtube') {
      await youtubeService.sendMessage(channelId, text)
    } else if (channel.platform === 'kick') {
      throw new Error('Sending messages on Kick is not supported (requires session cookie)')
    } else if (channel.platform === 'tiktok') {
      throw new Error('Sending messages on TikTok is not supported')
    }
  }

  private async executeTwitchModCommand(
    channelId: string,
    action: ModActionType,
    targetLogin: string,
    parts: string[]
  ): Promise<void> {
    let accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken) accessToken = await twitchAuth.refreshAccessToken()
    if (!accessToken) { log.warn('Cannot execute mod command: not authenticated'); return }

    const { twitchClientId: clientId } = settingsStore.get()
    if (!clientId) { log.warn('Cannot execute mod command: no client ID'); return }

    const targetUserId = await this.twitchService.lookupUserId(targetLogin, clientId, accessToken)
    if (!targetUserId) { log.warn(`Cannot execute mod command: user "${targetLogin}" not found`); return }

    // /timeout <user> <seconds> [reason] — default 600s if not provided
    const duration = action === 'timeout' ? (parseInt(parts[2]) || 600) : undefined

    await this.twitchService.modAction(channelId, action, { targetUserId, duration })
    log.info(`Mod command /${action} applied to ${targetLogin} (${targetUserId})${duration ? ` for ${duration}s` : ''}`)
  }

  logoutPlatform(platform: 'twitch' | 'youtube'): void {
    const settings = settingsStore.get()
    const affected = settings.channels.filter(c => c.platform === platform)

    if (platform === 'twitch') {
      this.twitchService.reset()
    } else if (platform === 'youtube') {
      youtubeService.disconnectAll()
    }

    for (const ch of affected) {
      this.setConnectionState(ch.id, 'disconnected')
    }
  }

  async modAction(payload: ModActionPayload): Promise<void> {
    const { channelId, action, targetUserId, messageId, duration } = payload
    const settings = settingsStore.get()
    const channel = settings.channels.find(c => c.id === channelId)
    if (!channel) throw new Error(`Channel ${channelId} not found`)

    if (channel.platform === 'twitch') {
      await this.twitchService.modAction(channelId, action, { targetUserId, messageId, duration })
    }
  }

  getSelfModStatuses(): Record<string, boolean> {
    return this.twitchService.getSelfModStatuses()
  }

  getAllConnectionStates(): ConnectionState[] {
    return Array.from(this.connectionStates.values())
  }

  getConnectionState(channelId: string): ConnectionState | undefined {
    return this.connectionStates.get(channelId)
  }

  /** Returns live viewer counts keyed by channelId for all connected Twitch channels. */
  async getViewerCounts(): Promise<Record<string, number>> {
    const settings = settingsStore.get()
    const accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken || !settings.twitchClientId) return {}

    const twitchChannels = settings.channels.filter(c => c.platform === 'twitch')
    if (twitchChannels.length === 0) return {}

    const params = twitchChannels.map(c => `user_login=${encodeURIComponent(c.slug)}`).join('&')
    try {
      const resp = await net.fetch(`${TWITCH_HELIX_BASE}/streams?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': settings.twitchClientId
        }
      })
      if (!resp.ok) return {}
      const data = await resp.json() as { data: Array<{ user_login: string; viewer_count: number }> }
      const counts: Record<string, number> = {}
      for (const stream of data.data ?? []) {
        const ch = twitchChannels.find(c => c.slug === stream.user_login.toLowerCase())
        if (ch) counts[ch.id] = stream.viewer_count
      }
      return counts
    } catch {
      return {}
    }
  }

  /** Consume cached recent messages for a channel (called by renderer after it's ready). */
  getRecentMessages(channelId: string): NormalizedMessage[] {
    const msgs = this.recentMessageCache.get(channelId) ?? []
    this.recentMessageCache.delete(channelId)
    return msgs
  }

  /** Fetches recent messages from the community recent-messages API and caches them. */
  private async fetchRecentMessages(channelId: string, slug: string, displayName: string): Promise<void> {
    const settings = settingsStore.get()
    const broadcasterId = this.twitchService.getBroadcasterId(channelId)
    try {
      const resp = await net.fetch(
        `https://recent-messages.robotty.de/api/v2/recent-messages/${encodeURIComponent(slug)}?limit=100`
      )
      if (!resp.ok) {
        log.warn(`fetchRecentMessages: HTTP ${resp.status} for ${slug}`)
        return
      }
      const data = await resp.json() as { messages?: string[] }
      if (!data.messages?.length) return

      const msgs: NormalizedMessage[] = []
      for (const line of data.messages) {
        try {
          const rawLine = line.replace(/\r$/, '')
          const parsed = parseIrcLine(rawLine)
          if (!parsed || parsed.command !== 'PRIVMSG') continue
          const isAction = rawLine.includes('\x01ACTION')
          const msg = normalizeTwitchMessage(
            parsed, channelId, displayName, broadcasterId,
            settings.mentionKeywords, settings.keywordAlerts, isAction
          )
          if (msg) msgs.push({ ...msg, isHistorical: true })
        } catch { /* skip malformed line */ }
      }
      if (msgs.length > 0) {
        // Cache for renderer pull (handles startup race condition)
        this.recentMessageCache.set(channelId, msgs)
        // Also try to push directly if renderer is already listening
        broadcaster.send(RENDERER_CHANNELS.RECENT_MESSAGES, { channelId, messages: msgs })
      }
    } catch (err) {
      log.warn('fetchRecentMessages failed for', slug, err)
    }
  }

  /** Fetch Twitch user card data (profile pic, follow date, sub status). */
  async getUserCard(payload: UserCardPayload): Promise<UserCardData | null> {
    const { userId, channelId, login } = payload
    const settings = settingsStore.get()
    let accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken) accessToken = await twitchAuth.refreshAccessToken()
    if (!accessToken || !settings.twitchClientId) return null

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': settings.twitchClientId
    }

    try {
      // Fetch user info
      const userResp = await net.fetch(`${TWITCH_HELIX_BASE}/users?id=${userId}`, { headers })
      if (!userResp.ok) return null
      const userData = await userResp.json() as { data?: Array<{ id: string; login: string; display_name: string; profile_image_url: string }> }
      const user = userData.data?.[0]
      if (!user) return null

      const broadcasterId = this.twitchService.getBroadcasterId(channelId)
      let followedAt: string | null = null
      let subTier: string | null = null
      let subMonths: number | null = null

      if (broadcasterId) {
        // Fetch follower info (requires moderator:read:followers)
        try {
          const followResp = await net.fetch(
            `${TWITCH_HELIX_BASE}/channels/followers?broadcaster_id=${broadcasterId}&user_id=${userId}`,
            { headers }
          )
          if (followResp.ok) {
            const followData = await followResp.json() as { data?: Array<{ followed_at: string }> }
            followedAt = followData.data?.[0]?.followed_at ?? null
          }
        } catch { /* scope not granted */ }

        // Fetch sub info (requires channel:read:subscriptions)
        try {
          const subResp = await net.fetch(
            `${TWITCH_HELIX_BASE}/subscriptions?broadcaster_id=${broadcasterId}&user_id=${userId}`,
            { headers }
          )
          if (subResp.ok) {
            const subData = await subResp.json() as { data?: Array<{ tier: string; is_gift: boolean }> }
            const sub = subData.data?.[0]
            if (sub) {
              subTier = sub.tier
              // cumulative_months not always available, use badge-info from messages instead
            }
          }
        } catch { /* scope not granted */ }
      }

      return {
        userId: user.id,
        login: user.login || login,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url,
        followedAt,
        subTier,
        subMonths
      }
    } catch (err) {
      log.warn('getUserCard failed for', login, err)
      return null
    }
  }
}

export const platformManager = new PlatformManager()
