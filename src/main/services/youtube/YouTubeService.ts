import log from 'electron-log'
import { youtubeApiClient } from './YouTubeApiClient'
import { normalizeYouTubeMessage } from './YouTubeMessageNormalizer'
import { settingsStore } from '../../store/SettingsStore'
import { buildSystemMessage } from '../twitch/TwitchMessageNormalizer'
import {
  YOUTUBE_DEFAULT_POLL_MS,
  YOUTUBE_DEDUP_WINDOW
} from '../../../shared/constants'
import type { NormalizedMessage } from '../../../shared/types/message'
import type { ConnectionStatus } from '../../../shared/types/channel'

type OnMessages = (msgs: NormalizedMessage[]) => void
type OnStatus = (channelId: string, status: ConnectionStatus, error?: string) => void

// How often to re-check for a live stream while the channel is offline
const OFFLINE_POLL_MS = 30_000

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
    await this.tryConnect()
  }

  /** Attempt to find a live stream. If none found, go 'offline' and retry every 30s. */
  private async tryConnect(): Promise<void> {
    if (this.stopped) return

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
      // Not live yet — go offline and retry
      log.info(`YouTube ${this.slug}: no active stream, will retry in ${OFFLINE_POLL_MS / 1000}s`)
      this.onStatus(this.channelId, 'offline')
      if (!this.stopped) {
        this.pollTimer = setTimeout(() => this.tryConnect(), OFFLINE_POLL_MS)
      }
      return
    }

    // Stream found — connect
    this.liveChatId = liveChatId
    this.onStatus(this.channelId, 'connected')
    log.info(`YouTube ${this.slug} live — chat ID: ${liveChatId}`)

    // Inject system message into chat
    const sysMsg = buildSystemMessage(
      this.channelId,
      this.displayName,
      `▶ ${this.displayName} is now live on YouTube`
    )
    this.onMessages([sysMsg])

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

  async modAction(
    action: 'ban' | 'timeout' | 'delete' | 'unban',
    payload: { targetUserId: string; messageId?: string; duration?: number }
  ): Promise<void> {
    if (!this.liveChatId) throw new Error('YouTube channel not connected or no live stream')
    if (action === 'delete') {
      if (!payload.messageId) throw new Error('messageId required for delete action')
      await youtubeApiClient.deleteMessage(payload.messageId)
    } else if (action === 'ban') {
      await youtubeApiClient.banUser(this.liveChatId, payload.targetUserId)
    } else if (action === 'timeout') {
      await youtubeApiClient.banUser(this.liveChatId, payload.targetUserId, payload.duration || 600)
    } else {
      // Unbanning needs the ban resource ID, which the API only returns at
      // ban time — we don't persist those, so unban isn't supported yet
      throw new Error('Unban is not supported for YouTube')
    }
  }

  private async poll(): Promise<void> {
    if (this.stopped || !this.liveChatId) return

    const result = await youtubeApiClient.fetchMessages(this.liveChatId, this.nextPageToken)

    if (!result) {
      // Null = stream ended or auth error
      log.info(`YouTube ${this.slug}: stream ended or auth error`)

      const settings = settingsStore.get()
      const hasAuth = !!(settings.googleClientId && settings.googleClientSecret)
      if (!hasAuth) {
        // Auth missing entirely
        this.onStatus(this.channelId, 'error', 'YouTube auth required')
        const authMsg = buildSystemMessage(
          this.channelId,
          this.displayName,
          '⚠ YouTube authentication required — please re-authenticate in Settings → Auth'
        )
        this.onMessages([authMsg])
        return
      }

      // Stream ended — go offline and wait for next stream
      this.onStatus(this.channelId, 'offline')
      this.liveChatId = null
      this.nextPageToken = undefined
      const endMsg = buildSystemMessage(
        this.channelId,
        this.displayName,
        `■ ${this.displayName} stream ended — watching for next stream…`
      )
      this.onMessages([endMsg])

      if (!this.stopped) {
        this.pollTimer = setTimeout(() => this.tryConnect(), OFFLINE_POLL_MS)
      }
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

  async modAction(
    channelId: string,
    action: 'ban' | 'timeout' | 'delete' | 'unban',
    payload: { targetUserId: string; messageId?: string; duration?: number }
  ): Promise<void> {
    const channel = this.channels.get(channelId)
    if (!channel) throw new Error(`YouTube channel ${channelId} not connected`)
    await channel.modAction(action, payload)
  }

  disconnectAll(): void {
    for (const channel of this.channels.values()) channel.stop()
    this.channels.clear()
  }
}

export const youtubeService = new YouTubeService()
