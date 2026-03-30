import type { ChannelConfig } from './channel'

export type Theme = 'dark' | 'light' | 'system'

export interface EmoteProviderSettings {
  sevenTv: boolean
  bttv: boolean
  ffz: boolean
}

export interface WindowBounds {
  x: number | null
  y: number | null
  width: number
  height: number
}

export interface AppSettings {
  // Channels
  channels: ChannelConfig[]

  // Auth / API keys (sensitive, stored in separate encrypted store)
  twitchClientId: string
  googleClientId: string
  youtubeApiKey: string  // fallback if no OAuth

  // Appearance
  theme: Theme
  fontSize: number
  showTimestamps: boolean
  showBadges: boolean
  showPlatformBadge: boolean
  emoteScale: number     // 1.0 = 1x line height multiplier

  // Emotes
  enabledProviders: EmoteProviderSettings

  // Filters
  keywordAlerts: string[]       // words that trigger highlight
  mentionKeywords: string[]     // words treated as mentions (your username, etc.)

  // Performance
  maxMessagesPerChannel: number

  // Window state
  windowBounds: WindowBounds
}

export const DEFAULT_SETTINGS: AppSettings = {
  channels: [],
  twitchClientId: '',
  googleClientId: '',
  youtubeApiKey: '',
  theme: 'dark',
  fontSize: 14,
  showTimestamps: true,
  showBadges: true,
  showPlatformBadge: true,
  emoteScale: 1.5,
  enabledProviders: { sevenTv: true, bttv: true, ffz: true },
  keywordAlerts: [],
  mentionKeywords: [],
  maxMessagesPerChannel: 5000,
  windowBounds: { x: null, y: null, width: 420, height: 900 }
}
