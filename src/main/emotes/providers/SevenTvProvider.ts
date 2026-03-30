import { net } from 'electron'
import log from 'electron-log'
import type { EmoteData } from '../../../shared/types/emote'

const BASE = 'https://7tv.io/v3'
const CDN = 'https://cdn.7tv.app/emote'

function buildUrls(id: string, animated: boolean): EmoteData['urls'] {
  const fmt = animated ? 'gif' : 'webp'
  return {
    x1: `${CDN}/${id}/1x.${fmt}`,
    x2: `${CDN}/${id}/2x.${fmt}`,
    x4: `${CDN}/${id}/4x.${fmt}`
  }
}

interface SevenTvEmote {
  id: string
  name: string
  flags: number
  data?: {
    id: string
    name: string
    flags: number
    animated: boolean
  }
}

interface SevenTvEmoteSet {
  id: string
  name: string
  emotes: SevenTvEmote[]
}

function normalizeEmotes(emotes: SevenTvEmote[]): EmoteData[] {
  return emotes
    .filter(e => e.data || e.id)
    .map(e => {
      const id = e.data?.id || e.id
      const name = e.data?.name || e.name
      const animated = e.data?.animated ?? false
      const flags = e.data?.flags ?? e.flags ?? 0
      const zeroWidth = (flags & 256) !== 0 // ZeroWidth flag

      return {
        id,
        name,
        provider: '7tv' as const,
        urls: buildUrls(id, animated),
        animated,
        zeroWidth
      }
    })
}

export async function fetchSevenTvChannelEmotes(
  platform: 'twitch' | 'kick',
  userId: string
): Promise<EmoteData[]> {
  try {
    const resp = await net.fetch(`${BASE}/users/${platform}/${userId}`)
    if (!resp.ok) return []
    const data = (await resp.json()) as { emote_set?: SevenTvEmoteSet }
    return normalizeEmotes(data.emote_set?.emotes ?? [])
  } catch (err) {
    log.error('7TV channel emotes fetch error:', err)
    return []
  }
}

export async function fetchSevenTvGlobalEmotes(): Promise<EmoteData[]> {
  try {
    const resp = await net.fetch(`${BASE}/emote-sets/global`)
    if (!resp.ok) return []
    const data = (await resp.json()) as SevenTvEmoteSet
    return normalizeEmotes(data.emotes ?? [])
  } catch (err) {
    log.error('7TV global emotes fetch error:', err)
    return []
  }
}
