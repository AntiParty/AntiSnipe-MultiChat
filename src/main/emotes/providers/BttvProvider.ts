import log from 'electron-log'
import type { EmoteData } from '../../../shared/types/emote'

const API = 'https://api.betterttv.net/3'
const CDN = 'https://cdn.betterttv.net/emote'

interface BttvEmote {
  id: string
  code: string
  imageType: string
  animated?: boolean
}

function normalize(emote: BttvEmote): EmoteData {
  const animated = emote.animated ?? emote.imageType === 'gif'
  return {
    id: emote.id,
    name: emote.code,
    provider: 'bttv',
    urls: {
      x1: `${CDN}/${emote.id}/1x`,
      x2: `${CDN}/${emote.id}/2x`,
      x4: `${CDN}/${emote.id}/3x`
    },
    animated,
    zeroWidth: false
  }
}

export async function fetchBttvChannelEmotes(
  platform: 'twitch' | 'kick',
  userId: string
): Promise<EmoteData[]> {
  try {
    const resp = await fetch(`${API}/cached/users/${platform}/${userId}`)
    if (!resp.ok) return []
    const data = (await resp.json()) as {
      channelEmotes?: BttvEmote[]
      sharedEmotes?: BttvEmote[]
    }
    return [
      ...(data.channelEmotes ?? []).map(normalize),
      ...(data.sharedEmotes ?? []).map(normalize)
    ]
  } catch (err) {
    log.error('BTTV channel emotes fetch error:', err)
    return []
  }
}

export async function fetchBttvGlobalEmotes(): Promise<EmoteData[]> {
  try {
    const resp = await fetch(`${API}/cached/emotes/global`)
    if (!resp.ok) return []
    const data = (await resp.json()) as BttvEmote[]
    return data.map(normalize)
  } catch (err) {
    log.error('BTTV global emotes fetch error:', err)
    return []
  }
}
