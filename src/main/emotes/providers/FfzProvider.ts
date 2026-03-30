import log from 'electron-log'
import type { EmoteData } from '../../../shared/types/emote'

const API = 'https://api.frankerfacez.com/v1'

interface FfzEmote {
  id: number
  name: string
  urls: Record<string, string>
  animated?: Record<string, string>
}

interface FfzSet {
  emoticons: FfzEmote[]
}

function normalize(emote: FfzEmote): EmoteData {
  const urls = emote.urls
  const animated = emote.animated
  return {
    id: String(emote.id),
    name: emote.name,
    provider: 'ffz',
    urls: {
      x1: animated?.['1'] || urls['1'] || Object.values(urls)[0],
      x2: animated?.['2'] || urls['2'] || animated?.['1'] || urls['1'] || Object.values(urls)[0],
      x4: animated?.['4'] || urls['4'] || animated?.['2'] || urls['2'] || Object.values(urls)[0]
    },
    animated: !!animated,
    zeroWidth: false
  }
}

export async function fetchFfzChannelEmotes(twitchUserId: string): Promise<EmoteData[]> {
  try {
    const resp = await fetch(`${API}/room/id/${twitchUserId}`)
    if (!resp.ok) return []
    const data = (await resp.json()) as { sets?: Record<string, FfzSet> }
    const emotes: EmoteData[] = []
    for (const set of Object.values(data.sets ?? {})) {
      emotes.push(...set.emoticons.map(normalize))
    }
    return emotes
  } catch (err) {
    log.error('FFZ channel emotes fetch error:', err)
    return []
  }
}

export async function fetchFfzGlobalEmotes(): Promise<EmoteData[]> {
  try {
    const resp = await fetch(`${API}/set/global`)
    if (!resp.ok) return []
    const data = (await resp.json()) as { sets?: Record<string, FfzSet> }
    const emotes: EmoteData[] = []
    for (const set of Object.values(data.sets ?? {})) {
      emotes.push(...set.emoticons.map(normalize))
    }
    return emotes
  } catch (err) {
    log.error('FFZ global emotes fetch error:', err)
    return []
  }
}
