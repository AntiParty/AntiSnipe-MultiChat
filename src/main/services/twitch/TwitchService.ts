import WebSocket from 'ws'
import { net } from 'electron'
import log from 'electron-log'
import { tokenStore } from '../../auth/TokenStore'
import { twitchAuth } from '../../auth/TwitchAuth'
import { settingsStore } from '../../store/SettingsStore'
import { twitchBadgeResolver } from './TwitchBadgeResolver'

import { parseIrcLine, nickFromPrefix } from './TwitchIrcParser'
import {
  normalizeTwitchMessage,
  normalizeUserNotice,
  normalizeRedeemEvent,
  buildSystemMessage
} from './TwitchMessageNormalizer'
import { TwitchEventSubClient } from './TwitchEventSubClient'
import { getSharedChatInfo, shouldDropSharedMessage } from './sharedChat'
import {
  TWITCH_IRC_URL,
  TWITCH_IRC_CAPS,
  TWITCH_PING_INTERVAL_MS,
  TWITCH_PONG_TIMEOUT_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  RECONNECT_JITTER,
  TWITCH_HELIX_BASE
} from '../../../shared/constants'
import type { NormalizedMessage, DeleteMessageEvent } from '../../../shared/types/message'
import type { ConnectionStatus } from '../../../shared/types/channel'
import type { ModActionType } from '../../../shared/types/ipc'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

type OnMessage = (msg: NormalizedMessage) => void
type OnDelete = (event: DeleteMessageEvent) => void
type OnStatus = (status: ConnectionStatus, error?: string) => void
type OnRoomState = (channelId: string, roomId: string) => void
type OnSelfModStatus = (channelId: string, isMod: boolean) => void

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
  private onRoomState: OnRoomState
  private onSelfModStatus: OnSelfModStatus
  private selfMessageKeys = new Map<string, number>() // "login:raw" → sent timestamp
  private selfBadgeTags = new Map<string, string>()   // channelId → last known badge tag string
  private selfModStatus = new Map<string, boolean>()  // channelId → is mod/broadcaster
  private eventSub: TwitchEventSubClient
  private sourceNameCache = new Map<string, string>() // shared-chat roomId → display name
  private sourceNameFetching = new Set<string>()

  constructor(onMessage: OnMessage, onDelete: OnDelete, onStatus: OnStatus, onRoomState: OnRoomState, onSelfModStatus: OnSelfModStatus) {
    this.onMessage = onMessage
    this.onDelete = onDelete
    this.onStatus = onStatus
    this.onRoomState = onRoomState
    this.onSelfModStatus = onSelfModStatus

    this.eventSub = new TwitchEventSubClient(
      ev => {
        // Find the channel's display name from our handle map
        const handle = this.channels.get(ev.channelId)
        const settings = settingsStore.get()
        const normalized = normalizeRedeemEvent(
          ev,
          handle?.displayName ?? ev.channelId,
          settings.mentionKeywords,
          settings.keywordAlerts
        )
        this.onMessage(normalized)
      },
      async () => {
        let accessToken = tokenStore.getAccessToken('twitch')
        if (!accessToken) {
          accessToken = await twitchAuth.refreshAccessToken()
        }
        return { accessToken, clientId: settingsStore.get().twitchClientId }
      }
    )
  }

  async joinChannel(handle: TwitchChannelHandle): Promise<void> {
    this.channels.set(handle.channelId, handle)
    // Re-emit mod status from cached badge tag so the renderer doesn't
    // have to wait for the next USERSTATE/PRIVMSG to show mod buttons
    const cached = this.selfBadgeTags.get(handle.channelId)
    if (cached !== undefined) {
      const isMod = cached.includes('moderator') || cached.includes('broadcaster')
      this.selfModStatus.set(handle.channelId, isMod)
      this.onSelfModStatus(handle.channelId, isMod)
    }
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
    if (handle?.broadcasterId) {
      this.eventSub.removeChannel(handle.broadcasterId)
    }
    this.channels.delete(channelId)
    if (this.channels.size === 0) {
      this.disconnect()
    }
  }

  sendMessage(channelId: string, text: string): void {
    const handle = this.channels.get(channelId)
    if (!handle) throw new Error(`Channel ${channelId} not connected`)
    if (this.ws?.readyState !== WebSocket.OPEN) throw new Error('Not connected to Twitch IRC')
    this.ws.send(`PRIVMSG #${handle.slug} :${text}\r\n`)
    // Record for echo deduplication — skip /commands since Twitch never echoes them
    if (!text.startsWith('/')) {
      const { username } = tokenStore.getUserInfo('twitch')
      if (username) {
        const key = `${username.toLowerCase()}:${text}`
        this.selfMessageKeys.set(key, Date.now())
        for (const [k, t] of this.selfMessageKeys) {
          if (Date.now() - t > 10_000) this.selfMessageKeys.delete(k)
        }
      }
    }
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
        // Notify each channel chat that we're reconnecting
        for (const handle of this.channels.values()) {
          this.onMessage(buildSystemMessage(
            handle.channelId,
            handle.displayName,
            'Reconnecting to Twitch…'
          ))
        }
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

      case 'PONG':
        if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null }
        break

      case '001':
      case '376': {
        // Connection confirmed — join all channels
        this.setStatus('connected')
        this.startPingInterval()
        for (const handle of this.channels.values()) {
          this.ws?.send(`JOIN #${handle.slug}\r\n`)
          this.loadBadges(handle).catch(log.error)
          // Only send "Connected" on reconnects (attempt > 0), not the initial join
          // (PlatformManager already injects it on first connect)
          if (this.reconnectAttempt > 0) {
            this.onMessage(buildSystemMessage(
              handle.channelId,
              handle.displayName,
              `Reconnected to #${handle.slug}`
            ))
          }
        }
        this.reconnectAttempt = 0
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

        // Shared Chat: drop foreign copies when their home channel is open here
        const shared = getSharedChatInfo(msg.tags, handle.broadcasterId)
        const sourceHandle = shared?.isForeign
          ? this.findHandleByBroadcasterId(shared.sourceRoomId)
          : undefined
        if (shouldDropSharedMessage(shared, !!sourceHandle)) break

        // Skip echo of own optimistically-injected messages
        const senderLogin = nickFromPrefix(msg.prefix || '').toLowerCase()
        const { username } = tokenStore.getUserInfo('twitch')
        if (username && senderLogin === username.toLowerCase()) {
          // Always capture the user's badge tag so optimistic messages can use it
          if (msg.tags['badges'] !== undefined) {
            const badgeStr = msg.tags['badges'] || ''
            this.selfBadgeTags.set(handle.channelId, badgeStr)
            const isMod = badgeStr.includes('moderator') || badgeStr.includes('broadcaster')
            const prev = this.selfModStatus.get(handle.channelId)
            if (prev !== isMod) {
              this.selfModStatus.set(handle.channelId, isMod)
              this.onSelfModStatus(handle.channelId, isMod)
            }
          }
          const echoKey = `${senderLogin}:${msg.params[1]}`
          if (this.selfMessageKeys.has(echoKey)) {
            this.selfMessageKeys.delete(echoKey)
            break
          }
        }

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
        if (normalized) {
          if (normalized.sharedSource) {
            normalized.sharedSource.channelName =
              this.resolveSourceChannelName(normalized.sharedSource.roomId)
          }
          this.onMessage(normalized)
        }
        break
      }

      case 'USERNOTICE': {
        const channel = msg.params[0]?.slice(1)
        const handle = this.findHandleBySlug(channel)
        if (!handle) break

        // Shared Chat: same dedup as PRIVMSG so subs/raids don't show twice
        const shared = getSharedChatInfo(msg.tags, handle.broadcasterId)
        if (shouldDropSharedMessage(shared, !!(shared && this.findHandleByBroadcasterId(shared.sourceRoomId)))) break

        const normalized = normalizeUserNotice(msg, handle.channelId, handle.displayName, handle.broadcasterId)
        if (normalized) {
          if (normalized.sharedSource) {
            normalized.sharedSource.channelName =
              this.resolveSourceChannelName(normalized.sharedSource.roomId)
          }
          this.onMessage(normalized)
        }
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
        // Chatterino-style moderation notices
        if (targetUser) {
          const duration = parseInt(msg.tags['ban-duration'] || '', 10)
          this.onMessage(buildSystemMessage(
            handle.channelId,
            handle.displayName,
            Number.isFinite(duration)
              ? `${targetUser} was timed out for ${formatDuration(duration)}.`
              : `${targetUser} was banned.`
          ))
        } else {
          this.onMessage(buildSystemMessage(handle.channelId, handle.displayName, 'Chat was cleared by a moderator.'))
        }
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

      case 'ROOMSTATE': {
        // room-id is the broadcaster's numeric Twitch user ID — free, no OAuth needed
        const channel = msg.params[0]?.slice(1)
        const handle = this.findHandleBySlug(channel)
        if (!handle) break
        const roomId = msg.tags['room-id']
        if (roomId && roomId !== handle.broadcasterId) {
          handle.broadcasterId = roomId
          this.loadBadges(handle).catch(log.error)
          this.onRoomState(handle.channelId, roomId)
          // Start EventSub subscription for channel point redeems
          this.eventSub.addChannel(roomId, handle.channelId)
        }
        break
      }

      case 'USERSTATE': {
        // Sent after JOIN and after each PRIVMSG — tells us our own badges in this channel
        const channel = msg.params[0]?.slice(1)
        const handle = this.findHandleBySlug(channel)
        if (!handle) break
        const badges = msg.tags['badges'] || ''
        this.selfBadgeTags.set(handle.channelId, badges)
        const isMod = badges.includes('moderator') || badges.includes('broadcaster')
        const prev = this.selfModStatus.get(handle.channelId)
        if (prev !== isMod) {
          this.selfModStatus.set(handle.channelId, isMod)
          this.onSelfModStatus(handle.channelId, isMod)
        }
        break
      }

      case 'NOTICE': {
        const noticeText = msg.params[1] || msg.params[0] || ''
        const noticeChannel = msg.params[0]?.slice(1)
        const noticeHandle = noticeChannel ? this.findHandleBySlug(noticeChannel) : null
        log.info('Twitch NOTICE:', msg.params.join(' '))

        // Auth failure — tell user to re-authenticate
        if (
          noticeText.toLowerCase().includes('login authentication failed') ||
          noticeText.toLowerCase().includes('improperly formatted auth') ||
          msg.tags['msg-id'] === 'msg_banned'
        ) {
          const target = noticeHandle ?? this.channels.values().next().value
          if (target) {
            this.onMessage(buildSystemMessage(
              target.channelId,
              target.displayName,
              '⚠ Twitch authentication failed — please re-authenticate in Settings → Auth'
            ))
          }
        }
        break
      }
    }
  }

  /** Full reset — clears all state so the service can start fresh after logout */
  reset(): void {
    this.stopped = false
    this.clearTimers()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.buffer = ''
    this.reconnectAttempt = 0
    this.channels.clear()
    this.selfMessageKeys.clear()
    this.selfBadgeTags.clear()
    this.selfModStatus.clear()
    this.eventSub.stop()
  }

  getSelfModStatuses(): Record<string, boolean> {
    return Object.fromEntries(this.selfModStatus)
  }

  getSelfBadgeTag(channelId: string): string {
    return this.selfBadgeTags.get(channelId) ?? ''
  }

  getBroadcasterId(channelId: string): string | undefined {
    return this.channels.get(channelId)?.broadcasterId
  }

  isSelfMod(channelId: string): boolean {
    return this.selfModStatus.get(channelId) ?? false
  }

  async lookupUserId(login: string, clientId: string, accessToken: string): Promise<string | null> {
    try {
      const resp = await net.fetch(
        `${TWITCH_HELIX_BASE}/users?login=${encodeURIComponent(login)}`,
        { headers: { Authorization: `Bearer ${accessToken}`, 'Client-Id': clientId } }
      )
      if (!resp.ok) return null
      const data = await resp.json() as { data?: { id: string }[] }
      return data.data?.[0]?.id ?? null
    } catch {
      return null
    }
  }

  async modAction(
    channelId: string,
    action: ModActionType,
    payload: { targetUserId: string; messageId?: string; duration?: number }
  ): Promise<void> {
    const handle = this.channels.get(channelId)
    if (!handle?.broadcasterId) throw new Error('No broadcaster ID for channel')

    let accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken) {
      accessToken = await twitchAuth.refreshAccessToken()
    }
    if (!accessToken) throw new Error('Not authenticated — token expired and refresh failed')

    const { twitchClientId: clientId } = settingsStore.get()
    const { userId: moderatorId } = tokenStore.getUserInfo('twitch')
    if (!clientId) throw new Error('Missing Twitch Client ID in settings')
    if (!moderatorId) throw new Error('Missing moderator user ID — try logging out and back in')

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
      'Content-Type': 'application/json'
    }

    if (action === 'delete') {
      if (!payload.messageId) throw new Error('messageId required for delete action')
      const url = `${TWITCH_HELIX_BASE}/chat/messages?broadcaster_id=${handle.broadcasterId}&moderator_id=${moderatorId}&message_id=${payload.messageId}`
      const resp = await net.fetch(url, { method: 'DELETE', headers })
      if (!resp.ok && resp.status !== 404) {
        // 404 means the message was already deleted or timed out — treat as success
        const text = await resp.text()
        throw new Error(`Delete message failed: ${resp.status} ${text}`)
      }
    } else if (action === 'timeout' || action === 'ban') {
      const url = `${TWITCH_HELIX_BASE}/moderation/bans?broadcaster_id=${handle.broadcasterId}&moderator_id=${moderatorId}`
      const data: Record<string, unknown> = { user_id: payload.targetUserId }
      if (action === 'timeout' && payload.duration) {
        data.duration = payload.duration
      }
      const resp = await net.fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data })
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`${action} failed: ${resp.status} ${text}`)
      }
    } else if (action === 'unban') {
      const url = `${TWITCH_HELIX_BASE}/moderation/bans?broadcaster_id=${handle.broadcasterId}&moderator_id=${moderatorId}&user_id=${payload.targetUserId}`
      const resp = await net.fetch(url, { method: 'DELETE', headers })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Unban failed: ${resp.status} ${text}`)
      }
    }
  }

  private findHandleBySlug(slug: string): TwitchChannelHandle | undefined {
    for (const handle of this.channels.values()) {
      if (handle.slug === slug) return handle
    }
    return undefined
  }

  private findHandleByBroadcasterId(broadcasterId: string): TwitchChannelHandle | undefined {
    for (const handle of this.channels.values()) {
      if (handle.broadcasterId === broadcasterId) return handle
    }
    return undefined
  }

  /** Display name for a shared-chat source room. Cache misses trigger a
   *  background Helix lookup, so the first message may show a generic
   *  "shared" tag and later ones get "via ChannelName". */
  private resolveSourceChannelName(roomId: string): string | undefined {
    const handle = this.findHandleByBroadcasterId(roomId)
    if (handle) return handle.displayName
    const cached = this.sourceNameCache.get(roomId)
    if (cached) return cached
    if (!this.sourceNameFetching.has(roomId)) {
      this.sourceNameFetching.add(roomId)
      this.fetchSourceChannelName(roomId)
        .catch(err => log.warn('Shared-chat name lookup failed:', err))
        .finally(() => this.sourceNameFetching.delete(roomId))
    }
    return undefined
  }

  private async fetchSourceChannelName(roomId: string): Promise<void> {
    let accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken) accessToken = await twitchAuth.refreshAccessToken()
    const { twitchClientId: clientId } = settingsStore.get()
    if (!accessToken || !clientId) return
    const resp = await net.fetch(`${TWITCH_HELIX_BASE}/users?id=${encodeURIComponent(roomId)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Client-Id': clientId }
    })
    if (!resp.ok) return
    const data = await resp.json() as { data?: Array<{ display_name?: string; login?: string }> }
    const name = data.data?.[0]?.display_name || data.data?.[0]?.login
    if (name) this.sourceNameCache.set(roomId, name)
  }

  private async loadBadges(handle: TwitchChannelHandle): Promise<void> {
    const accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken) return
    const { twitchClientId: clientId } = settingsStore.get()
    if (!clientId) return
    await twitchBadgeResolver.loadGlobalBadgesIfNeeded(clientId, accessToken)
    if (handle.broadcasterId) {
      await twitchBadgeResolver.loadChannelBadges(handle.broadcasterId, clientId, accessToken)
    }
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
