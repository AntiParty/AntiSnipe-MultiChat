import log from 'electron-log'
import { youtubeApiClient } from './YouTubeApiClient'
import { normalizeYouTubeMessage } from './YouTubeMessageNormalizer'
import { settingsStore } from '../../store/SettingsStore'
import {
  YOUTUBE_DEFAULT_POLL_MS,
  YOUTUBE_DEDUP_WINDOW
} from '../../../shared/constants'
import type { NormalizedMessage } from '../../../shared/types/message'
import type { ConnectionStatus } from '../../../shared/types/channel'

type OnMessages = (msgs: NormalizedMessage[]) => void
type OnStatus = (channelId: string, status: ConnectionStatus, error?: string) => void

export class YouTubeChannel {
  readonly channelId: string
  readonly slug: string
  readonly displayName: string
  private liveChatId: string | null = null
  private nextPageToken: string | undefined
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private seenIds: Set<string> = new Set()
  private stopped = false
  private onMessages: OnMessages
  private onStatus: OnStatus

  constructor(
    channelId: string,
    slug: string,
    displayName: string,
    onMessages: OnMessages,
    onStatus: OnStatus
  ) {
    this.channelId = channelId
    this.slug = slug
    this.displayName = displayName
    this.onMessages = onMessages
    this.onStatus = onStatus
  }

  async start(): Promise<void> {
    this.stopped = false
    this.onStatus(this.channelId, 'connecting')

    // Resolve the slug to a live chat ID.
    // Accept: 11-char video ID, full watch URL (youtube.com/watch?v=...), or channel handle.
    let liveChatId: string | null = null
    let resolvedVideoId = this.slug

    // Extract video ID from a pasted URL (watch?v=, /live/, /shorts/, youtu.be/)
    try {
      const parsed = new URL(this.slug.startsWith('http') ? this.slug : `https://${this.slug}`)
      const v = parsed.searchParams.get('v')
        ?? parsed.pathname.match(/\/(?:live|shorts|embed)\/([A-Za-z0-9_-]{11})/)?.[1]
        ?? (parsed.hostname === 'youtu.be' ? parsed.pathname.slice(1) : null)
      if (v) resolvedVideoId = v
    } catch { /* not a URL */ }

    if (/^[A-Za-z0-9_-]{11}$/.test(resolvedVideoId)) {
      liveChatId = await youtubeApiClient.getLiveChatId(resolvedVideoId)
    }
    if (!liveChatId) {
      liveChatId = await youtubeApiClient.getChannelLiveChatId(this.slug)
    }

    if (!liveChatId) {
      this.onStatus(this.channelId, 'error', 'No active live stream found')
      return
    }

    this.liveChatId = liveChatId
    this.onStatus(this.channelId, 'connected')
    log.info(`YouTube channel ${this.slug} live chat ID: ${liveChatId}`)
    this.poll()
  }

  stop(): void {
    this.stopped = true
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.liveChatId) throw new Error('YouTube channel not connected or no live stream')
    await youtubeApiClient.sendMessage(this.liveChatId, text)
  }

  private async poll(): Promise<void> {
    if (this.stopped || !this.liveChatId) return

    const result = await youtubeApiClient.fetchMessages(this.liveChatId, this.nextPageToken)

    if (!result) {
      // Null result = live stream ended or auth error
      log.info(`YouTube channel ${this.slug} ended or auth error`)
      this.onStatus(this.channelId, 'ended')
      return
    }

    this.nextPageToken = result.nextPageToken

    if (result.items.length > 0) {
      const settings = settingsStore.get()
      const messages: NormalizedMessage[] = []

      for (const item of result.items) {
        const msg = normalizeYouTubeMessage(
          item,
          this.channelId,
          this.displayName,
          settings.mentionKeywords,
          settings.keywordAlerts,
          this.seenIds
        )
        if (msg) messages.push(msg)
      }

      // Keep dedup set bounded
      if (this.seenIds.size > YOUTUBE_DEDUP_WINDOW) {
        const arr = Array.from(this.seenIds)
        this.seenIds = new Set(arr.slice(-YOUTUBE_DEDUP_WINDOW))
      }

      if (messages.length > 0) this.onMessages(messages)
    }

    const interval = Math.max(result.pollingIntervalMillis || YOUTUBE_DEFAULT_POLL_MS, 3000)
    if (!this.stopped) {
      this.pollTimer = setTimeout(() => this.poll(), interval)
    }
  }
}

export class YouTubeService {
  private channels = new Map<string, YouTubeChannel>()

  async joinChannel(
    channelId: string,
    slug: string,
    displayName: string,
    onMessages: OnMessages,
    onStatus: OnStatus
  ): Promise<void> {
    const channel = new YouTubeChannel(channelId, slug, displayName, onMessages, onStatus)
    this.channels.set(channelId, channel)
    await channel.start()
  }

  leaveChannel(channelId: string): void {
    const channel = this.channels.get(channelId)
    if (channel) {
      channel.stop()
      this.channels.delete(channelId)
    }
  }

  sendMessage(channelId: string, text: string): void {
    this.channels.get(channelId)?.sendMessage(text)
  }

  disconnectAll(): void {
    for (const channel of this.channels.values()) channel.stop()
    this.channels.clear()
  }
}

export const youtubeService = new YouTubeService()
