import log from 'electron-log'
import { net } from 'electron'
import { TwitchService } from './twitch/TwitchService'
import { TwitchChatterPoller } from './twitch/TwitchChatterPoller'
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
import { getCurrentSong } from './media'
import type { ConnectChannelPayload, ConnectionState } from '../../shared/types/channel'
import type { NormalizedMessage, DeleteMessageEvent } from '../../shared/types/message'
import type { ModActionPayload, ModActionType, UserCardPayload, UserCardData, StreamInfo, PinnedMessage } from '../../shared/types/ipc'
import type { ViewerListPayload } from '../../shared/types/viewer'

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
  private chatterPoller: TwitchChatterPoller

  constructor() {
    this.tiktokService = new TikTokService(
      msg => this.handleMessage(msg),
      (channelId, status, error) => this.setConnectionState(channelId, status, error)
    )

    this.chatterPoller = new TwitchChatterPoller(
      (payload: ViewerListPayload) => broadcaster.send(RENDERER_CHANNELS.VIEWER_LIST_UPDATE, payload),
      () => this.twitchService
    )

    this.twitchService = new TwitchService(
      msg => this.handleMessage(msg),
      event => this.handleDelete(event),
      (_status, _error) => {},
      (channelId, roomId) => {
        // ROOMSTATE gives us the broadcaster's numeric user ID for free — use it for emotes
        emoteCacheManager.fetchForChannel({ channelId, twitchUserId: roomId }).catch(log.error)
        // Now that we have a broadcasterId, start polling if user is a mod/broadcaster
        if (this.twitchService.isSelfMod(channelId)) {
          this.chatterPoller.startPolling(channelId)
        }
      },
      (channelId, isMod) => {
        broadcaster.send(RENDERER_CHANNELS.SELF_MOD_STATUS, { channelId, isMod })
        if (isMod) {
          this.chatterPoller.startPolling(channelId)
        } else {
          this.chatterPoller.stopPolling(channelId)
        }
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
      // Bot-style: plugin intercepts an incoming message and sends a response.
      // Only respond in the signed-in user's OWN channel, and never to
      // foreign Shared Chat messages — otherwise the account would post
      // bot replies into other streamers' chats.
      if (!msg.sharedSource && this.isOwnChannel(msg.channelId)) {
        // Fire-and-forget so a slow lookup (e.g. !song) never delays delivery
        this.respondToPluginCommand(msg, action.respond).catch(err =>
          log.error('Plugin command send failed:', err)
        )
      } else {
        log.info(`Plugin command ignored in ${msg.channelId} (not own channel or shared chat)`)
      }
      // Fall through — still show the original message in chat
    } else if (action) {
      // highlight / tag / replace — bake into message for renderer
      msg.pluginAction = action
    }
    broadcaster.enqueue(msg)
  }

  /** True when the channel belongs to the signed-in account (their own chat). */
  private isOwnChannel(channelId: string): boolean {
    const channel = settingsStore.get().channels.find(c => c.id === channelId)
    if (!channel) return false
    if (channel.platform === 'twitch') {
      const { username } = tokenStore.getUserInfo('twitch')
      return !!username && channel.slug.toLowerCase() === username.toLowerCase()
    }
    if (channel.platform === 'youtube') {
      // YouTube usernames are channel titles — compare against slug/display name
      const { username } = tokenStore.getUserInfo('youtube')
      return !!username && (
        channel.displayName.toLowerCase() === username.toLowerCase() ||
        channel.slug.replace(/^@/, '').toLowerCase() === username.toLowerCase()
      )
    }
    return false
  }

  private async respondToPluginCommand(msg: NormalizedMessage, respond: string): Promise<void> {
    if (respond === '__song__') {
      if (process.platform === 'win32') {
        const song = await getCurrentSong()
        respond = song ? `♪ Now playing: ${song}` : 'Nothing is playing right now.'
      } else {
        respond = '(not supported on this OS)'
      }
    }
    const settings = settingsStore.get()
    if (settings.pluginMentionUsers) {
      respond = `@${msg.authorDisplayName} ${respond}`
    }
    await this.sendMessage(msg.channelId, respond)
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

        // With OAuth we can moderate (delete/timeout/ban) if the user is the
        // chat owner or a moderator — enable the mod UI optimistically; the
        // API returns a clear permission error otherwise
        if (tokenStore.getAuthState('youtube').status === 'authenticated') {
          broadcaster.send(RENDERER_CHANNELS.SELF_MOD_STATUS, { channelId, isMod: true })
        }
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
      this.chatterPoller.stopPolling(channelId)
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
      this.chatterPoller.stopAll()
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
    } else if (channel.platform === 'youtube') {
      await youtubeService.modAction(channelId, action, { targetUserId, messageId, duration })
    } else {
      throw new Error(`Mod actions are not supported on ${channel.platform}`)
    }
  }

  getSelfModStatuses(): Record<string, boolean> {
    const statuses = this.twitchService.getSelfModStatuses()
    // YouTube: mod UI is available for all connected channels when authed
    if (tokenStore.getAuthState('youtube').status === 'authenticated') {
      for (const ch of settingsStore.get().channels) {
        if (ch.platform === 'youtube') statuses[ch.id] = true
      }
    }
    return statuses
  }

  getAllConnectionStates(): ConnectionState[] {
    return Array.from(this.connectionStates.values())
  }

  getConnectionState(channelId: string): ConnectionState | undefined {
    return this.connectionStates.get(channelId)
  }

  /** Returns live viewer counts keyed by channelId for all connected Twitch channels. */
  async getViewerCounts(): Promise<Record<string, number>> {
    const info = await this.getStreamInfo()
    const counts: Record<string, number> = {}
    for (const [channelId, stream] of Object.entries(info)) {
      counts[channelId] = stream.viewerCount
    }
    return counts
  }

  /** Live stream metadata (viewers, game, uptime) keyed by channelId. */
  async getStreamInfo(): Promise<Record<string, StreamInfo>> {
    const settings = settingsStore.get()
    let accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken) accessToken = await twitchAuth.refreshAccessToken()
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
      const data = await resp.json() as {
        data: Array<{
          user_login: string
          viewer_count: number
          game_name?: string
          title?: string
          started_at?: string
        }>
      }
      const info: Record<string, StreamInfo> = {}
      for (const stream of data.data ?? []) {
        const ch = twitchChannels.find(c => c.slug === stream.user_login.toLowerCase())
        if (ch) {
          info[ch.id] = {
            viewerCount: stream.viewer_count,
            gameName: stream.game_name ?? '',
            title: stream.title ?? '',
            startedAt: stream.started_at ?? ''
          }
        }
      }
      return info
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

  getViewerList(channelId: string): ViewerListPayload | null {
    return this.chatterPoller.getLastResult(channelId)
  }

  // ── Twitch pinned messages ────────────────────────────────────────────────

  async getPinnedMessage(channelId: string): Promise<PinnedMessage | null> {
    return this.twitchService.getPinnedMessage(channelId)
  }

  async pinMessage(channelId: string, messageId: string, durationSeconds?: number): Promise<void> {
    await this.twitchService.pinMessage(channelId, messageId, durationSeconds)
  }

  async unpinMessage(channelId: string, messageId: string): Promise<void> {
    await this.twitchService.unpinMessage(channelId, messageId)
  }
}

export const platformManager = new PlatformManager()
