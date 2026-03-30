import WebSocket from 'ws'
import log from 'electron-log'
import { tokenStore } from '../../auth/TokenStore'
import { twitchAuth } from '../../auth/TwitchAuth'
import { settingsStore } from '../../store/SettingsStore'
import { twitchBadgeResolver } from './TwitchBadgeResolver'
import { parseIrcLine, nickFromPrefix } from './TwitchIrcParser'
import {
  normalizeTwitchMessage,
  normalizeUserNotice
} from './TwitchMessageNormalizer'
import {
  TWITCH_IRC_URL,
  TWITCH_IRC_CAPS,
  TWITCH_PING_INTERVAL_MS,
  TWITCH_PONG_TIMEOUT_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  RECONNECT_JITTER
} from '../../../shared/constants'
import type { NormalizedMessage, DeleteMessageEvent } from '../../../shared/types/message'
import type { ConnectionStatus } from '../../../shared/types/channel'

type OnMessage = (msg: NormalizedMessage) => void
type OnDelete = (event: DeleteMessageEvent) => void
type OnStatus = (status: ConnectionStatus, error?: string) => void

interface TwitchChannelHandle {
  channelId: string
  slug: string
  displayName: string
  broadcasterId?: string
}

export class TwitchService {
  private ws: WebSocket | null = null
  private buffer = ''
  private channels = new Map<string, TwitchChannelHandle>()
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private onMessage: OnMessage
  private onDelete: OnDelete
  private onStatus: OnStatus

  constructor(onMessage: OnMessage, onDelete: OnDelete, onStatus: OnStatus) {
    this.onMessage = onMessage
    this.onDelete = onDelete
    this.onStatus = onStatus
  }

  async joinChannel(handle: TwitchChannelHandle): Promise<void> {
    this.channels.set(handle.channelId, handle)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(`JOIN #${handle.slug}\r\n`)
      await this.loadBadges(handle)
    } else {
      await this.connect()
    }
  }

  leaveChannel(channelId: string): void {
    const handle = this.channels.get(channelId)
    if (handle && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(`PART #${handle.slug}\r\n`)
    }
    this.channels.delete(channelId)
    if (this.channels.size === 0) {
      this.disconnect()
    }
  }

  sendMessage(channelId: string, text: string): void {
    const handle = this.channels.get(channelId)
    if (!handle || this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(`PRIVMSG #${handle.slug} :${text}\r\n`)
  }

  disconnect(): void {
    this.stopped = true
    this.clearTimers()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    this.stopped = false
    this.setStatus('connecting')
    this.buffer = ''

    this.ws = new WebSocket(TWITCH_IRC_URL)

    this.ws.on('open', async () => {
      log.info('Twitch IRC connected')
      this.reconnectAttempt = 0
      await this.authenticate()
    })

    this.ws.on('message', data => {
      this.buffer += data.toString()
      let idx: number
      while ((idx = this.buffer.indexOf('\r\n')) !== -1) {
        const line = this.buffer.slice(0, idx)
        this.buffer = this.buffer.slice(idx + 2)
        if (line) this.handleLine(line)
      }
    })

    this.ws.on('close', () => {
      log.info('Twitch IRC disconnected')
      this.clearTimers()
      if (!this.stopped && this.channels.size > 0) {
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', err => {
      log.error('Twitch IRC WebSocket error:', err)
      this.setStatus('error', err.message)
    })
  }

  private async authenticate(): Promise<void> {
    let accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken) {
      accessToken = await twitchAuth.refreshAccessToken()
    }

    const settings = settingsStore.get()
    const clientId = settings.twitchClientId

    if (accessToken && clientId) {
      const { username } = tokenStore.getUserInfo('twitch')
      this.ws!.send(`CAP REQ :${TWITCH_IRC_CAPS}\r\n`)
      this.ws!.send(`PASS oauth:${accessToken}\r\n`)
      this.ws!.send(`NICK ${username || 'justinfan12345'}\r\n`)
    } else {
      // Anonymous fallback
      const rand = Math.floor(10000 + Math.random() * 89999)
      this.ws!.send(`CAP REQ :${TWITCH_IRC_CAPS}\r\n`)
      this.ws!.send(`NICK justinfan${rand}\r\n`)
    }
  }

  private handleLine(line: string): void {
    const msg = parseIrcLine(line)
    if (!msg) return

    switch (msg.command) {
      case 'PING':
        this.ws?.send(`PONG :${msg.params[0] || 'tmi.twitch.tv'}\r\n`)
        break

      case '001':
      case '376': {
        // Connection confirmed — join all channels
        this.setStatus('connected')
        this.startPingInterval()
        for (const handle of this.channels.values()) {
          this.ws?.send(`JOIN #${handle.slug}\r\n`)
          this.loadBadges(handle).catch(log.error)
        }
        break
      }

      case 'RECONNECT':
        log.info('Twitch requested RECONNECT')
        this.ws?.close()
        break

      case 'PRIVMSG': {
        const channel = msg.params[0]?.slice(1) // remove leading #
        const handle = this.findHandleBySlug(channel)
        if (!handle) break

        const isAction =
          msg.params[1]?.startsWith('\x01ACTION ') && msg.params[1].endsWith('\x01')
        const settings = settingsStore.get()
        const normalized = normalizeTwitchMessage(
          msg,
          handle.channelId,
          handle.displayName,
          handle.broadcasterId,
          settings.mentionKeywords,
          settings.keywordAlerts,
          isAction
        )
        if (normalized) this.onMessage(normalized)
        break
      }

      case 'USERNOTICE': {
        const channel = msg.params[0]?.slice(1)
        const handle = this.findHandleBySlug(channel)
        if (!handle) break
        const normalized = normalizeUserNotice(msg, handle.channelId, handle.displayName)
        if (normalized) this.onMessage(normalized)
        break
      }

      case 'CLEARCHAT': {
        const channel = msg.params[0]?.slice(1)
        const handle = this.findHandleBySlug(channel)
        if (!handle) break
        const targetUser = msg.params[1]
        this.onDelete({
          channelId: handle.channelId,
          authorId: targetUser ? msg.tags['target-user-id'] : undefined
        })
        break
      }

      case 'CLEARMSG': {
        const channel = msg.params[0]?.slice(1)
        const handle = this.findHandleBySlug(channel)
        if (!handle) break
        this.onDelete({
          channelId: handle.channelId,
          messageId: msg.tags['target-msg-id']
        })
        break
      }

      case 'NOTICE':
        log.info('Twitch NOTICE:', msg.params.join(' '))
        break
    }
  }

  private findHandleBySlug(slug: string): TwitchChannelHandle | undefined {
    for (const handle of this.channels.values()) {
      if (handle.slug === slug) return handle
    }
    return undefined
  }

  private async loadBadges(handle: TwitchChannelHandle): Promise<void> {
    const accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken || !handle.broadcasterId) return
    const settings = settingsStore.get()
    await twitchBadgeResolver.loadChannelBadges(
      handle.broadcasterId,
      settings.twitchClientId,
      accessToken
    )
  }

  private startPingInterval(): void {
    this.clearTimers()
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('PING :tmi.twitch.tv\r\n')
        this.pongTimer = setTimeout(() => {
          log.warn('Twitch IRC PONG timeout — reconnecting')
          this.ws?.close()
        }, TWITCH_PONG_TIMEOUT_MS)
      }
    }, TWITCH_PING_INTERVAL_MS)
  }

  private clearTimers(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt++
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt - 1),
      RECONNECT_MAX_MS
    ) * (1 + Math.random() * RECONNECT_JITTER)

    log.info(`Twitch IRC reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`)
    this.setStatus('reconnecting')

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch(log.error)
    }, delay)
  }

  private setStatus(status: ConnectionStatus, error?: string): void {
    for (const handle of this.channels.values()) {
      this.onStatus(status, error)
    }
  }
}
