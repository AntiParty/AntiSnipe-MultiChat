import type { ChannelConfig } from './channel'

export type Theme = 'dark' | 'light' | 'system'
export type MessageSpacing = 'compact' | 'normal' | 'comfortable'
export type TimestampFormat = '12h' | '24h'
export type UsernameDisplay = 'display-name' | 'login' | 'both'
export type DeletedMessageStyle = 'cross-out' | 'hide'
export type AnimateEmotes = 'always' | 'focused' | 'never'

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

export interface ModButtonSettings {
  showDelete: boolean
  showTimeout: boolean
  showBan: boolean
  timeoutPresets: number[] // seconds
}

export interface AppSettings {
  // Channels
  channels: ChannelConfig[]

  // Auth / API keys
  twitchClientId: string
  twitchClientSecret: string
  googleClientId: string
  googleClientSecret: string
  youtubeApiKey: string

  // Appearance
  theme: Theme
  fontSize: number
  showTimestamps: boolean
  timestampFormat: TimestampFormat
  showBadges: boolean
  showPlatformBadge: boolean
  emoteScale: number
  messageSpacing: MessageSpacing
  alternatingRows: boolean
  usernameDisplay: UsernameDisplay
  /** Gray out messages that arrive via Twitch Shared Chat from other channels. */
  dimSharedChatMessages: boolean

  // Emotes
  enabledProviders: EmoteProviderSettings

  // Emote animation
  animateEmotes: AnimateEmotes

  // 7TV cosmetics
  show7tvBadges: boolean
  show7tvPaints: boolean

  // Chat behavior
  showDeletedMessages: DeletedMessageStyle
  showReplyContext: boolean
  pauseScrollOnHover: boolean
  smoothScroll: boolean
  showConnectionAlerts: boolean
  hideCommands: boolean
  flashOnMention: boolean

  // Filters
  keywordAlerts: string[]
  mentionKeywords: string[]

  // Performance
  maxMessagesPerChannel: number

  // Mod actions
  modButtons: ModButtonSettings

  // Plugins
  pluginMentionUsers: boolean

  // Profile / history
  clickableUsernames: boolean   // open Twitch/YouTube profile on click
  showViewerCount: boolean      // show live viewer count in All tab + sidebar
  loadRecentMessages: boolean   // fetch last 100 messages on channel join

  // Viewer list panel
  showViewerList: boolean
  viewerListWidth: number

  // Window state
  windowBounds: WindowBounds
}

export const DEFAULT_SETTINGS: AppSettings = {
  channels: [],
  twitchClientId: '',
  twitchClientSecret: '',
  googleClientId: '',
  googleClientSecret: '',
  youtubeApiKey: '',
  theme: 'dark',
  fontSize: 14,
  showTimestamps: true,
  timestampFormat: '24h',
  showBadges: true,
  showPlatformBadge: true,
  emoteScale: 1.5,
  messageSpacing: 'normal',
  alternatingRows: false,
  usernameDisplay: 'display-name',
  dimSharedChatMessages: false,
  enabledProviders: { sevenTv: true, bttv: true, ffz: true },
  animateEmotes: 'always',
  show7tvBadges: true,
  show7tvPaints: true,
  showDeletedMessages: 'cross-out',
  showReplyContext: true,
  pauseScrollOnHover: false,
  smoothScroll: false,
  showConnectionAlerts: true,
  hideCommands: false,
  flashOnMention: true,
  keywordAlerts: [],
  mentionKeywords: [],
  maxMessagesPerChannel: 5000,
  modButtons: {
    showDelete: true,
    showTimeout: true,
    showBan: true,
    timeoutPresets: [60, 600, 3600, 86400]
  },
  pluginMentionUsers: false,
  clickableUsernames: true,
  showViewerCount: false,
  loadRecentMessages: true,
  showViewerList: false,
  viewerListWidth: 180,
  windowBounds: { x: null, y: null, width: 420, height: 900 }
}
