import { net } from 'electron'
import log from 'electron-log'
import { tokenStore } from '../../auth/TokenStore'
import { youtubeAuth } from '../../auth/YouTubeAuth'
import { settingsStore } from '../../store/SettingsStore'
import { YOUTUBE_API_BASE } from '../../../shared/constants'

export interface YoutubeChatMessage {
  id: string
  snippet: {
    type: string
    liveChatId: string
    authorChannelId: string
    publishedAt: string
    hasDisplayContent: boolean
    displayMessage: string
    superChatDetails?: {
      amountDisplayString: string
      userComment: string
    }
  }
  authorDetails: {
    channelId: string
    channelUrl: string
    displayName: string
    profileImageUrl: string
    isVerified: boolean
    isChatOwner: boolean
    isChatSponsor: boolean
    isChatModerator: boolean
  }
}

export interface LiveChatMessagesResponse {
  kind: string
  nextPageToken?: string
  pollingIntervalMillis: number
  pageInfo: { totalResults: number; resultsPerPage: number }
  items: YoutubeChatMessage[]
}

export class YouTubeApiClient {
  private async getAuthHeader(): Promise<Record<string, string> | null> {
    let accessToken = tokenStore.getAccessToken('youtube')
    if (!accessToken) {
      accessToken = await youtubeAuth.refreshAccessToken()
    }
    if (accessToken) {
      return { Authorization: `Bearer ${accessToken}` }
    }

    // Fallback to API key
    const apiKey = settingsStore.get().youtubeApiKey
    if (apiKey) return null // API key is passed as query param
    return null
  }

  private addApiKey(url: URL): void {
    const apiKey = settingsStore.get().youtubeApiKey
    if (apiKey && !tokenStore.getAccessToken('youtube')) {
      url.searchParams.set('key', apiKey)
    }
  }

  async getLiveChatId(videoId: string): Promise<string | null> {
    try {
      const url = new URL(`${YOUTUBE_API_BASE}/videos`)
      url.searchParams.set('id', videoId)
      url.searchParams.set('part', 'liveStreamingDetails')
      this.addApiKey(url)

      const authHeaders = await this.getAuthHeader()
      const resp = await net.fetch(url.toString(), {
        headers: authHeaders ?? {}
      })

      if (!resp.ok) {
        log.error('YouTube videos API error:', resp.status, await resp.text())
        return null
      }

      const data = (await resp.json()) as {
        items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[]
      }
      return data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null
    } catch (err) {
      log.error('getLiveChatId failed:', err)
      return null
    }
  }

  private async resolveChannelId(slug: string): Promise<string | null> {
    // Already a real channel ID
    if (slug.startsWith('UC')) return slug

    // Try as handle (@name or name)
    const handle = slug.startsWith('@') ? slug : `@${slug}`
    try {
      const url = new URL(`${YOUTUBE_API_BASE}/channels`)
      url.searchParams.set('part', 'id')
      url.searchParams.set('forHandle', handle)
      this.addApiKey(url)
      const authHeaders = await this.getAuthHeader()
      const resp = await net.fetch(url.toString(), { headers: authHeaders ?? {} })
      if (resp.ok) {
        const data = (await resp.json()) as { items?: { id: string }[] }
        if (data.items?.[0]?.id) return data.items[0].id
      }
    } catch { /* fall through */ }

    // Fallback: legacy username lookup
    try {
      const url = new URL(`${YOUTUBE_API_BASE}/channels`)
      url.searchParams.set('part', 'id')
      url.searchParams.set('forUsername', slug.replace(/^@/, ''))
      this.addApiKey(url)
      const authHeaders = await this.getAuthHeader()
      const resp = await net.fetch(url.toString(), { headers: authHeaders ?? {} })
      if (resp.ok) {
        const data = (await resp.json()) as { items?: { id: string }[] }
        if (data.items?.[0]?.id) return data.items[0].id
      }
    } catch { /* fall through */ }

    return null
  }

  async getChannelLiveChatId(slug: string): Promise<string | null> {
    try {
      const channelId = await this.resolveChannelId(slug)
      if (!channelId) {
        log.warn(`Could not resolve YouTube channel ID for slug: ${slug}`)
        return null
      }

      const url = new URL(`${YOUTUBE_API_BASE}/search`)
      url.searchParams.set('part', 'id')
      url.searchParams.set('channelId', channelId)
      url.searchParams.set('type', 'video')
      url.searchParams.set('eventType', 'live')
      url.searchParams.set('maxResults', '1')
      this.addApiKey(url)

      const authHeaders = await this.getAuthHeader()
      const resp = await net.fetch(url.toString(), { headers: authHeaders ?? {} })
      if (!resp.ok) return null

      const data = (await resp.json()) as { items?: { id: { videoId: string } }[] }
      const videoId = data.items?.[0]?.id?.videoId
      if (!videoId) return null

      return this.getLiveChatId(videoId)
    } catch (err) {
      log.error('getChannelLiveChatId failed:', err)
      return null
    }
  }

  async fetchMessages(
    liveChatId: string,
    pageToken?: string
  ): Promise<LiveChatMessagesResponse | null> {
    try {
      const url = new URL(`${YOUTUBE_API_BASE}/liveChat/messages`)
      url.searchParams.set('liveChatId', liveChatId)
      url.searchParams.set('part', 'id,snippet,authorDetails')
      url.searchParams.set('maxResults', '2000')
      if (pageToken) url.searchParams.set('pageToken', pageToken)
      this.addApiKey(url)

      const authHeaders = await this.getAuthHeader()
      const resp = await net.fetch(url.toString(), { headers: authHeaders ?? {} })

      if (resp.status === 403) {
        log.warn('YouTube API 403 — live stream ended or quota exceeded')
        return null
      }
      if (resp.status === 401) {
        // Try refresh
        const newToken = await youtubeAuth.refreshAccessToken()
        if (!newToken) return null
        const retryResp = await net.fetch(url.toString(), {
          headers: { Authorization: `Bearer ${newToken}` }
        })
        if (!retryResp.ok) return null
        return (await retryResp.json()) as LiveChatMessagesResponse
      }
      if (!resp.ok) {
        log.error('YouTube chat API error:', resp.status)
        return null
      }

      return (await resp.json()) as LiveChatMessagesResponse
    } catch (err) {
      log.error('fetchMessages failed:', err)
      return null
    }
  }

  async sendMessage(liveChatId: string, messageText: string): Promise<boolean> {
    let accessToken = tokenStore.getAccessToken('youtube')
    if (!accessToken) accessToken = await youtubeAuth.refreshAccessToken()
    if (!accessToken) return false

    try {
      const resp = await net.fetch(`${YOUTUBE_API_BASE}/liveChat/messages?part=snippet`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          snippet: {
            liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: { messageText }
          }
        })
      })
      return resp.ok
    } catch {
      return false
    }
  }
}

export const youtubeApiClient = new YouTubeApiClient()
