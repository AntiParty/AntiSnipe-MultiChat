import log from 'electron-log'
import { TWITCH_HELIX_BASE } from '../../../shared/constants'
import type { BadgeInfo } from '../../../shared/types/message'

interface TwitchBadgeVersion {
  id: string
  image_url_1x: string
  image_url_2x: string
  image_url_4x: string
  title: string
  description: string
}

interface TwitchBadgeSet {
  set_id: string
  versions: TwitchBadgeVersion[]
}

type BadgeCache = Map<string, Map<string, TwitchBadgeVersion>>

class TwitchBadgeResolver {
  private globalBadges: BadgeCache = new Map()
  private channelBadges: Map<string, BadgeCache> = new Map()

  async loadGlobalBadges(clientId: string, accessToken: string): Promise<void> {
    try {
      const resp = await fetch(`${TWITCH_HELIX_BASE}/chat/badges/global`, {
        headers: {
          'Client-Id': clientId,
          Authorization: `Bearer ${accessToken}`
        }
      })
      if (!resp.ok) return
      const data = (await resp.json()) as { data: TwitchBadgeSet[] }
      this.globalBadges = this.indexBadges(data.data)
      log.info(`Loaded ${this.globalBadges.size} global Twitch badge sets`)
    } catch (err) {
      log.error('Failed to load global Twitch badges:', err)
    }
  }

  async loadChannelBadges(
    broadcasterId: string,
    clientId: string,
    accessToken: string
  ): Promise<void> {
    try {
      const resp = await fetch(
        `${TWITCH_HELIX_BASE}/chat/badges?broadcaster_id=${broadcasterId}`,
        {
          headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
      if (!resp.ok) return
      const data = (await resp.json()) as { data: TwitchBadgeSet[] }
      this.channelBadges.set(broadcasterId, this.indexBadges(data.data))
    } catch (err) {
      log.error('Failed to load channel Twitch badges:', err)
    }
  }

  private indexBadges(sets: TwitchBadgeSet[]): BadgeCache {
    const cache: BadgeCache = new Map()
    for (const set of sets) {
      const versions = new Map<string, TwitchBadgeVersion>()
      for (const version of set.versions) {
        versions.set(version.id, version)
      }
      cache.set(set.set_id, versions)
    }
    return cache
  }

  resolve(badgeTag: string, broadcasterId?: string): BadgeInfo[] {
    if (!badgeTag) return []
    const channelCache = broadcasterId ? this.channelBadges.get(broadcasterId) : undefined
    const result: BadgeInfo[] = []

    for (const part of badgeTag.split(',')) {
      const slashIdx = part.indexOf('/')
      if (slashIdx === -1) continue
      const setId = part.slice(0, slashIdx)
      const versionId = part.slice(slashIdx + 1)

      // Check channel badges first, then global
      const version =
        channelCache?.get(setId)?.get(versionId) ?? this.globalBadges.get(setId)?.get(versionId)

      if (version) {
        result.push({
          id: setId,
          version: versionId,
          title: version.title,
          imageUrl: version.image_url_2x
        })
      }
    }
    return result
  }
}

export const twitchBadgeResolver = new TwitchBadgeResolver()
