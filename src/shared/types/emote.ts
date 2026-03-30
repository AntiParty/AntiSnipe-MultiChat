export type EmoteProvider = '7tv' | 'bttv' | 'ffz' | 'twitch' | 'kick'

export interface EmoteUrls {
  x1: string
  x2: string
  x4: string
}

export interface EmoteData {
  id: string
  name: string
  provider: EmoteProvider
  urls: EmoteUrls
  animated: boolean
  zeroWidth: boolean
}

// Serializable version stored in disk cache
export interface SerializedEmoteCache {
  version: number
  timestamp: number
  channels: Record<string, ChannelEmoteCache>
  global: GlobalEmoteCache
}

export interface ChannelEmoteCache {
  channelId: string
  fetchedAt: number
  emotes: EmoteData[]
}

export interface GlobalEmoteCache {
  fetchedAt: number
  sevenTv: EmoteData[]
  bttv: EmoteData[]
  ffz: EmoteData[]
}
