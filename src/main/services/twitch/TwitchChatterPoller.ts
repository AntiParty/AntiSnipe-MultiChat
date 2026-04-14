import { net } from 'electron'
import log from 'electron-log'
import { tokenStore } from '../../auth/TokenStore'
import { twitchAuth } from '../../auth/TwitchAuth'
import { settingsStore } from '../../store/SettingsStore'
import { TWITCH_HELIX_BASE } from '../../../shared/constants'
import type { TwitchService } from './TwitchService'
import type { ViewerEntry, ViewerListPayload } from '../../../shared/types/viewer'

const POLL_INTERVAL_MS = 60_000

export class TwitchChatterPoller {
  private timers = new Map<string, ReturnType<typeof setInterval>>()
  private lastResults = new Map<string, ViewerListPayload>()
  private onUpdate: (payload: ViewerListPayload) => void
  private getTwitchService: () => TwitchService

  constructor(onUpdate: (payload: ViewerListPayload) => void, getTwitchService: () => TwitchService) {
    this.onUpdate = onUpdate
    this.getTwitchService = getTwitchService
  }

  startPolling(channelId: string): void {
    if (this.timers.has(channelId)) return  // already polling
    const broadcasterId = this.getTwitchService().getBroadcasterId(channelId)
    if (!broadcasterId) return  // wait for ROOMSTATE

    this.fetchChatters(channelId, broadcasterId).catch(log.error)
    const timer = setInterval(() => {
      const bid = this.getTwitchService().getBroadcasterId(channelId)
      if (bid) this.fetchChatters(channelId, bid).catch(log.error)
    }, POLL_INTERVAL_MS)
    this.timers.set(channelId, timer)
  }

  stopPolling(channelId: string): void {
    const timer = this.timers.get(channelId)
    if (timer !== undefined) {
      clearInterval(timer)
      this.timers.delete(channelId)
    }
  }

  stopAll(): void {
    for (const timer of this.timers.values()) clearInterval(timer)
    this.timers.clear()
  }

  getLastResult(channelId: string): ViewerListPayload | null {
    return this.lastResults.get(channelId) ?? null
  }

  private async fetchChatters(channelId: string, broadcasterId: string): Promise<void> {
    const settings = settingsStore.get()
    if (!settings.twitchClientId) return

    let accessToken = tokenStore.getAccessToken('twitch')
    if (!accessToken) accessToken = await twitchAuth.refreshAccessToken()
    if (!accessToken) return

    const selfInfo = tokenStore.getUserInfo('twitch')
    const selfUserId = selfInfo?.userId
    if (!selfUserId) return

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': settings.twitchClientId
    }

    const allViewers: ViewerEntry[] = []
    let cursor: string | undefined
    let totalCount = 0

    try {
      do {
        const params = new URLSearchParams({
          broadcaster_id: broadcasterId,
          moderator_id: selfUserId,
          first: '1000'
        })
        if (cursor) params.set('after', cursor)

        const resp = await net.fetch(`${TWITCH_HELIX_BASE}/chat/chatters?${params}`, { headers })

        if (resp.status === 401 || resp.status === 403) {
          log.warn(`TwitchChatterPoller: no mod access for channel ${channelId} (${resp.status}), stopping`)
          this.stopPolling(channelId)
          return
        }

        if (!resp.ok) {
          log.warn(`TwitchChatterPoller: HTTP ${resp.status} for channel ${channelId}`)
          return
        }

        const data = await resp.json() as {
          data: Array<{ user_id: string; user_login: string; user_name: string }>
          pagination: { cursor?: string }
          total: number
        }

        totalCount = data.total
        for (const u of data.data ?? []) {
          allViewers.push({
            userId: u.user_id,
            login: u.user_login,
            displayName: u.user_name,
            platform: 'twitch',
            role: 'viewer',
            isMod: false,
            isVip: false,
            isSub: false,
            isBroadcaster: u.user_id === broadcasterId,
            badges: [],
            color: null,
            messageCount: 0,
            lastSeenAt: 0,
            fromApi: true
          })
        }

        cursor = data.pagination?.cursor
      } while (cursor)

      const payload: ViewerListPayload = {
        channelId,
        viewers: allViewers,
        totalCount,
        isApiData: true
      }
      this.lastResults.set(channelId, payload)
      this.onUpdate(payload)
    } catch (err) {
      log.warn(`TwitchChatterPoller: fetch failed for ${channelId}`, err)
    }
  }
}
