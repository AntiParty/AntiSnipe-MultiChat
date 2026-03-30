import Pusher from 'pusher-js'
import log from 'electron-log'
import { kickApiClient } from './KickApiClient'
import { normalizeKickMessage } from './KickMessageNormalizer'
import { settingsStore } from '../../store/SettingsStore'
import {
  KICK_PUSHER_APP_KEY,
  KICK_PUSHER_CLUSTER,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  RECONNECT_JITTER
} from '../../../shared/constants'
import type { NormalizedMessage } from '../../../shared/types/message'
import type { ConnectionStatus } from '../../../shared/types/channel'
import type { RawKickMessage } from './KickMessageNormalizer'

type OnMessage = (msg: NormalizedMessage) => void
type OnStatus = (channelId: string, status: ConnectionStatus, error?: string) => void

interface KickChannelHandle {
  channelId: string
  slug: string
  displayName: string
  chatroomId: number
}

export class KickService {
  private pusher: Pusher | null = null
  private channels = new Map<string, KickChannelHandle>()
  private subscriptions = new Map<string, ReturnType<Pusher['subscribe']>>()
  private onMessage: OnMessage
  private onStatus: OnStatus

  constructor(onMessage: OnMessage, onStatus: OnStatus) {
    this.onMessage = onMessage
    this.onStatus = onStatus
  }

  async joinChannel(channelId: string, slug: string, displayName: string): Promise<void> {
    this.onStatus(channelId, 'connecting')

    const chatroomId = await kickApiClient.getChatroomId(slug)
    if (chatroomId === null) {
      this.onStatus(channelId, 'error', `Channel "${slug}" not found on Kick`)
      return
    }

    const handle: KickChannelHandle = { channelId, slug, displayName, chatroomId }
    this.channels.set(channelId, handle)

    if (!this.pusher) {
      this.initPusher()
    }

    const channelName = `chatrooms.${chatroomId}.v2`
    const sub = this.pusher!.subscribe(channelName)

    sub.bind('App\\Events\\ChatMessageEvent', (data: RawKickMessage) => {
      try {
        const settings = settingsStore.get()
        const msg = normalizeKickMessage(
          data,
          channelId,
          displayName,
          settings.mentionKeywords,
          settings.keywordAlerts
        )
        if (msg) this.onMessage(msg)
      } catch (err) {
        log.error('Kick message normalization error:', err)
      }
    })

    sub.bind('pusher:subscription_succeeded', () => {
      log.info(`Kick subscribed to ${channelName}`)
      this.onStatus(channelId, 'connected')
    })

    sub.bind('pusher:subscription_error', (err: unknown) => {
      log.error(`Kick subscription error for ${channelName}:`, err)
      this.onStatus(channelId, 'error', 'Kick subscription failed')
    })

    this.subscriptions.set(channelId, sub)
  }

  leaveChannel(channelId: string): void {
    const handle = this.channels.get(channelId)
    if (handle && this.pusher) {
      const channelName = `chatrooms.${handle.chatroomId}.v2`
      this.pusher.unsubscribe(channelName)
    }
    this.subscriptions.delete(channelId)
    this.channels.delete(channelId)

    if (this.channels.size === 0) {
      this.pusher?.disconnect()
      this.pusher = null
    }
  }

  disconnectAll(): void {
    if (this.pusher) {
      this.pusher.disconnect()
      this.pusher = null
    }
    this.channels.clear()
    this.subscriptions.clear()
  }

  private initPusher(): void {
    this.pusher = new Pusher(KICK_PUSHER_APP_KEY, {
      cluster: KICK_PUSHER_CLUSTER,
      forceTLS: true
    })

    this.pusher.connection.bind('connected', () => {
      log.info('Kick Pusher connected')
    })

    this.pusher.connection.bind('disconnected', () => {
      log.info('Kick Pusher disconnected')
      // Pusher-js handles reconnect automatically
    })

    this.pusher.connection.bind('error', (err: unknown) => {
      log.error('Kick Pusher connection error:', err)
    })
  }
}
