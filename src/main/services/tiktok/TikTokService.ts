import log from 'electron-log'
import {
  normalizeTikTokChat,
  normalizeTikTokGift,
  normalizeTikTokSubscribe,
  type TikTokChatData,
  type TikTokGiftData,
  type TikTokSubscribeData
} from './TikTokMessageNormalizer'
import type { NormalizedMessage } from '../../../shared/types/message'
import type { ConnectionStatus } from '../../../shared/types/channel'

// Lazy-loaded on first connect to avoid blocking app startup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tiktokModule: any = null
function getTikTokModule() {
  if (!_tiktokModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _tiktokModule = require('tiktok-live-connector')
  }
  return _tiktokModule
}

type OnMessage = (msg: NormalizedMessage) => void
type OnStatus = (channelId: string, status: ConnectionStatus, error?: string) => void

interface ChannelHandle {
  channelId: string
  slug: string
  displayName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: any
}

export class TikTokService {
  private channels = new Map<string, ChannelHandle>()
  private onMessage: OnMessage
  private onStatus: OnStatus

  constructor(onMessage: OnMessage, onStatus: OnStatus) {
    this.onMessage = onMessage
    this.onStatus = onStatus
  }

  async joinChannel(channelId: string, slug: string, displayName: string): Promise<void> {
    this.onStatus(channelId, 'connecting')

    // Ensure username has @ prefix for tiktok-live-connector
    const uniqueId = slug.startsWith('@') ? slug : `@${slug}`

    const { TikTokLiveConnection, WebcastEvent } = getTikTokModule()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = new TikTokLiveConnection(uniqueId)

    const handle: ChannelHandle = { channelId, slug, displayName, connection }
    this.channels.set(channelId, handle)

    // Chat messages
    connection.on(WebcastEvent.CHAT, (data: TikTokChatData) => {
      try {
        const msg = normalizeTikTokChat(data, channelId, displayName)
        if (msg) this.onMessage(msg)
      } catch (err) {
        log.error('TikTok chat normalization error:', err)
      }
    })

    // Gifts — only fire on streak end to avoid spam
    connection.on(WebcastEvent.GIFT, (data: TikTokGiftData) => {
      try {
        const msg = normalizeTikTokGift(data, channelId, displayName)
        if (msg) this.onMessage(msg)
      } catch (err) {
        log.error('TikTok gift normalization error:', err)
      }
    })

    // Subscriptions
    connection.on(WebcastEvent.SUBSCRIBE ?? 'subscribe', (data: TikTokSubscribeData) => {
      try {
        const msg = normalizeTikTokSubscribe(data, channelId, displayName)
        this.onMessage(msg)
      } catch (err) {
        log.error('TikTok subscribe normalization error:', err)
      }
    })

    // Stream ended
    connection.on(WebcastEvent.STREAM_END ?? 'streamEnd', () => {
      log.info(`TikTok stream ended for ${slug}`)
      this.onStatus(channelId, 'ended')
    })

    // Connection errors
    connection.on('error', (err: Error) => {
      log.error(`TikTok connection error for ${slug}:`, err)
      this.onStatus(channelId, 'error', err?.message ?? String(err))
    })

    connection.on('disconnected', () => {
      log.info(`TikTok disconnected from ${slug}`)
      if (this.channels.has(channelId)) {
        this.onStatus(channelId, 'disconnected')
      }
    })

    try {
      await connection.connect()
      log.info(`TikTok connected to ${slug}`)
      this.onStatus(channelId, 'connected')
    } catch (err) {
      this.channels.delete(channelId)
      const msg = err instanceof Error ? err.message : String(err)
      const isOffline = msg.toLowerCase().includes("isn't online") || msg.toLowerCase().includes('not online')
      if (isOffline) {
        log.info(`TikTok: ${slug} is not live`)
        this.onStatus(channelId, 'offline', `${slug} is not currently live`)
      } else {
        log.error(`TikTok failed to connect to ${slug}:`, err)
        this.onStatus(channelId, 'error', msg)
      }
    }
  }

  leaveChannel(channelId: string): void {
    const handle = this.channels.get(channelId)
    if (handle) {
      try { handle.connection.disconnect() } catch { /* ignore */ }
      this.channels.delete(channelId)
    }
  }

  disconnectAll(): void {
    for (const handle of this.channels.values()) {
      try { handle.connection.disconnect() } catch { /* ignore */ }
    }
    this.channels.clear()
  }
}

