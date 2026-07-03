import WebSocket from 'ws'
import { net } from 'electron'
import log from 'electron-log'
import { TWITCH_HELIX_BASE } from '../../../shared/constants'

const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws'
const RECONNECT_DELAY_MS = 5_000

export interface RedeemEventData {
  channelId: string
  broadcasterId: string
  rewardId: string
  rewardTitle: string
  userId: string
  userLogin: string
  userDisplayName: string
  userInput: string
  timestamp: string  // ISO date string
}

interface EventSubMsg {
  metadata: { message_type: string }
  payload: {
    session?: {
      id: string
      keepalive_timeout_seconds: number
      reconnect_url?: string
    }
    subscription?: { type: string }
    event?: Record<string, unknown>
  }
}

/**
 * Connects to the Twitch EventSub WebSocket and subscribes to
 * channel.channel_points_custom_reward_redemption.add for each channel.
 *
 * This delivers ALL channel point redemptions (with and without text input),
 * which the IRC layer cannot provide.
 *
 * Subscription will silently fail (403) for channels where the authenticated
 * user is neither the broadcaster nor a moderator — that is expected and safe.
 */
export class TwitchEventSubClient {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private subscribed = new Set<string>()          // broadcasterIds with confirmed subscriptions
  private channelMap = new Map<string, string>()  // broadcasterId → channelId
  private keepaliveTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  private onRedeem: (data: RedeemEventData) => void
  private getAuth: () => Promise<{ accessToken: string | null; clientId: string }>

  constructor(
    onRedeem: (data: RedeemEventData) => void,
    // Async so callers can refresh an expired access token before we subscribe
    getAuth: () => Promise<{ accessToken: string | null; clientId: string }>
  ) {
    this.onRedeem = onRedeem
    this.getAuth = getAuth
  }

  /** Call this once the broadcaster ID is known (from IRC ROOMSTATE). */
  addChannel(broadcasterId: string, channelId: string): void {
    this.channelMap.set(broadcasterId, channelId)
    if (this.sessionId) {
      this.subscribeWithAuth(broadcasterId).catch(log.error)
    } else {
      this.ensureConnected()
    }
  }

  private async subscribeWithAuth(broadcasterId: string): Promise<void> {
    const { accessToken, clientId } = await this.getAuth()
    if (accessToken && clientId) {
      await this.subscribe(broadcasterId, accessToken, clientId)
    }
  }

  removeChannel(broadcasterId: string): void {
    this.channelMap.delete(broadcasterId)
    this.subscribed.delete(broadcasterId)
    if (this.channelMap.size === 0) {
      this.stopped = true
      this.clearTimers()
      this.ws?.close()
      this.ws = null
      this.sessionId = null
    }
  }

  stop(): void {
    this.stopped = true
    this.clearTimers()
    this.ws?.close()
    this.ws = null
    this.sessionId = null
    this.subscribed.clear()
    this.channelMap.clear()
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private ensureConnected(): void {
    if (this.stopped) this.stopped = false
    if (!this.ws ||
        this.ws.readyState === WebSocket.CLOSED ||
        this.ws.readyState === WebSocket.CLOSING) {
      this.connect()
    }
  }

  private connect(url = EVENTSUB_URL): void {
    this.sessionId = null
    this.subscribed.clear()

    try {
      this.ws = new WebSocket(url)
    } catch (err) {
      log.error('EventSub: failed to create WebSocket:', err)
      return
    }

    this.ws.on('open', () => {
      log.info('EventSub: WebSocket connected')
    })

    this.ws.on('message', (raw) => {
      try {
        this.handleMessage(JSON.parse(raw.toString()) as EventSubMsg)
      } catch (err) {
        log.error('EventSub: message parse error:', err)
      }
    })

    this.ws.on('close', () => {
      log.info('EventSub: WebSocket closed')
      this.clearTimers()
      if (!this.stopped && this.channelMap.size > 0) {
        log.info(`EventSub: reconnecting in ${RECONNECT_DELAY_MS}ms`)
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS)
      }
    })

    this.ws.on('error', (err) => {
      log.error('EventSub: WebSocket error:', err.message)
    })
  }

  private handleMessage(msg: EventSubMsg): void {
    const type = msg.metadata?.message_type

    switch (type) {
      case 'session_welcome': {
        this.sessionId = msg.payload.session?.id ?? null
        const keepaliveSecs = msg.payload.session?.keepalive_timeout_seconds ?? 10
        // Give 2 extra seconds beyond Twitch's stated timeout
        this.resetKeepalive((keepaliveSecs + 2) * 1000)
        log.info('EventSub: session ready', this.sessionId)
        this.subscribeAllChannels().catch(log.error)
        break
      }

      case 'session_keepalive':
        this.resetKeepalive(12_000)
        break

      case 'session_reconnect': {
        // Twitch wants us to reconnect to a different URL before the old one closes
        const newUrl = msg.payload.session?.reconnect_url
        if (newUrl) {
          log.info('EventSub: reconnect requested to', newUrl)
          // Connect to new URL first, then close old one
          this.clearTimers()
          this.connect(newUrl)
        }
        break
      }

      case 'notification': {
        const subType = msg.payload.subscription?.type
        if (subType === 'channel.channel_points_custom_reward_redemption.add') {
          const ev = msg.payload.event as {
            broadcaster_user_id: string
            reward: { id: string; title: string }
            user_id: string
            user_login: string
            user_name: string
            user_input: string
            redeemed_at: string
          }
          const channelId = this.channelMap.get(ev.broadcaster_user_id)
          if (channelId) {
            this.onRedeem({
              channelId,
              broadcasterId: ev.broadcaster_user_id,
              rewardId: ev.reward.id,
              rewardTitle: ev.reward.title,
              userId: ev.user_id,
              userLogin: ev.user_login,
              userDisplayName: ev.user_name,
              userInput: ev.user_input ?? '',
              timestamp: ev.redeemed_at
            })
          }
        }
        break
      }

      case 'revocation':
        log.warn('EventSub: subscription revoked — may need re-auth or scope is missing')
        break
    }
  }

  private async subscribeAllChannels(): Promise<void> {
    const { accessToken, clientId } = await this.getAuth()
    if (!accessToken || !clientId) {
      // Anonymous (or refresh failed): Twitch drops sessions with no
      // subscriptions after ~10s, which put us in a permanent
      // connect/close/reconnect loop. Pause instead — the next
      // addChannel() (channel join or re-auth rejoin) re-arms us.
      log.warn('EventSub: no auth available — pausing until the next channel join')
      this.stopped = true
      this.clearTimers()
      this.ws?.close()
      this.ws = null
      this.sessionId = null
      return
    }
    for (const broadcasterId of this.channelMap.keys()) {
      if (!this.subscribed.has(broadcasterId)) {
        this.subscribe(broadcasterId, accessToken, clientId).catch(log.error)
      }
    }
  }

  private async subscribe(broadcasterId: string, accessToken: string, clientId: string): Promise<void> {
    if (this.subscribed.has(broadcasterId) || !this.sessionId) return

    try {
      const resp = await net.fetch(`${TWITCH_HELIX_BASE}/eventsub/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': clientId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'channel.channel_points_custom_reward_redemption.add',
          version: '1',
          condition: { broadcaster_user_id: broadcasterId },
          transport: { method: 'websocket', session_id: this.sessionId }
        })
      })

      if (resp.ok || resp.status === 409) {
        // 409 = already subscribed (e.g. after reconnect), treat as success
        this.subscribed.add(broadcasterId)
        log.info('EventSub: subscribed to redeems for broadcaster', broadcasterId)
      } else {
        const body = await resp.text()
        if (resp.status === 403 || resp.status === 401) {
          // Expected when watching someone else's channel without moderator scope
          log.info(`EventSub: no permission to read redeems for ${broadcasterId} (${resp.status}) — this is normal for non-owned channels`)
        } else {
          log.warn('EventSub: subscription failed:', resp.status, body)
        }
      }
    } catch (err) {
      log.error('EventSub: subscribe error:', err)
    }
  }

  private resetKeepalive(ms: number): void {
    if (this.keepaliveTimer) clearTimeout(this.keepaliveTimer)
    this.keepaliveTimer = setTimeout(() => {
      log.warn('EventSub: keepalive timeout — reconnecting')
      this.ws?.close()
    }, ms)
  }

  private clearTimers(): void {
    if (this.keepaliveTimer) { clearTimeout(this.keepaliveTimer); this.keepaliveTimer = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
  }
}
