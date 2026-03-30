import log from 'electron-log'
import { TwitchService } from './twitch/TwitchService'
import { youtubeService } from './youtube/YouTubeService'
import { KickService } from './kick/KickService'
import { broadcaster } from '../ipc/broadcaster'
import { settingsStore } from '../store/SettingsStore'
import { emoteCacheManager } from '../emotes/EmoteCacheManager'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import type { ConnectChannelPayload, ConnectionState } from '../../shared/types/channel'
import type { NormalizedMessage, DeleteMessageEvent } from '../../shared/types/message'

class PlatformManager {
  private connectionStates = new Map<string, ConnectionState>()
  private twitchService: TwitchService
  private kickService: KickService

  constructor() {
    this.twitchService = new TwitchService(
      msg => this.handleMessage(msg),
      event => this.handleDelete(event),
      (_status, _error) => {},
      (channelId, roomId) => {
        // ROOMSTATE gives us the broadcaster's numeric user ID for free — use it for emotes
        emoteCacheManager.fetchForChannel({ channelId, twitchUserId: roomId }).catch(log.error)
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
    }

    this.setConnectionState(channelId, 'disconnected')
  }

  disconnectAll(): void {
    this.twitchService.disconnect()
    youtubeService.disconnectAll()
    this.kickService.disconnectAll()
    for (const channelId of this.connectionStates.keys()) {
      this.setConnectionState(channelId, 'disconnected')
    }
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    const settings = settingsStore.get()
    const channel = settings.channels.find(c => c.id === channelId)
    if (!channel) throw new Error(`Channel ${channelId} not found in settings`)

    if (channel.platform === 'twitch') {
      this.twitchService.sendMessage(channelId, text)
    } else if (channel.platform === 'youtube') {
      youtubeService.sendMessage(channelId, text)
    } else if (channel.platform === 'kick') {
      log.warn('Kick send message requires session cookie — limited support')
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
