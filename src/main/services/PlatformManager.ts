import log from 'electron-log'
import { TwitchService } from './twitch/TwitchService'
import { youtubeService } from './youtube/YouTubeService'
import { KickService } from './kick/KickService'
import { TikTokService } from './tiktok/TikTokService'
import { broadcaster } from '../ipc/broadcaster'
import { settingsStore } from '../store/SettingsStore'
import { emoteCacheManager } from '../emotes/EmoteCacheManager'
import { tokenStore } from '../auth/TokenStore'
import { twitchAuth } from '../auth/TwitchAuth'
import { buildSelfMessage } from './twitch/TwitchMessageNormalizer'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import type { ConnectChannelPayload, ConnectionState } from '../../shared/types/channel'
import type { NormalizedMessage, DeleteMessageEvent } from '../../shared/types/message'
import type { ModActionPayload, ModActionType } from '../../shared/types/ipc'

// Twitch removed these commands from IRC in Feb 2023 — must use Helix API instead
const REMOVED_IRC_COMMANDS: Record<string, ModActionType | 'unban'> = {
  '/ban':      'ban',
  '/timeout':  'timeout',
  '/unban':    'unban',
  '/untimeout':'unban'
}

class PlatformManager {
  private connectionStates = new Map<string, ConnectionState>()
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
    broadcaster.enqueue(msg)
  }

  private handleDelete(event: DeleteMessageEvent): void {
    broadcaster.send(RENDERER_CHANNELS.DELETE_MESSAGE, event)
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
        // broadcasterId and emote fetch happen automatically via ROOMSTATE after join
        await this.twitchService.joinChannel({ channelId, slug, displayName })
        this.setConnectionState(channelId, 'connected')
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
      youtubeService.sendMessage(channelId, text)
    } else if (channel.platform === 'kick') {
      log.warn('Kick send message requires session cookie — limited support')
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

  getAllConnectionStates(): ConnectionState[] {
    return Array.from(this.connectionStates.values())
  }

  getConnectionState(channelId: string): ConnectionState | undefined {
    return this.connectionStates.get(channelId)
  }
}

export const platformManager = new PlatformManager()
