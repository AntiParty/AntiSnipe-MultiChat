import Store from 'electron-store'
import { z } from 'zod'
import { DEFAULT_SETTINGS } from '../../shared/types/settings'
import type { AppSettings } from '../../shared/types/settings'

const channelConfigSchema = z.object({
  id: z.string(),
  platform: z.enum(['twitch', 'youtube', 'kick']),
  slug: z.string(),
  displayName: z.string(),
  enabled: z.boolean()
})

const settingsSchema = z.object({
  channels: z.array(channelConfigSchema).default([]),
  twitchClientId: z.string().default(''),
  twitchClientSecret: z.string().default(''),
  googleClientId: z.string().default(''),
  youtubeApiKey: z.string().default(''),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  fontSize: z.number().min(8).max(32).default(14),
  showTimestamps: z.boolean().default(true),
  timestampFormat: z.enum(['12h', '24h']).default('24h'),
  showBadges: z.boolean().default(true),
  showPlatformBadge: z.boolean().default(true),
  emoteScale: z.number().min(0.5).max(3).default(1.5),
  messageSpacing: z.enum(['compact', 'normal', 'comfortable']).default('normal'),
  alternatingRows: z.boolean().default(false),
  usernameDisplay: z.enum(['display-name', 'login', 'both']).default('display-name'),
  enabledProviders: z.object({
    sevenTv: z.boolean().default(true),
    bttv: z.boolean().default(true),
    ffz: z.boolean().default(true)
  }).default({}),
  animateEmotes: z.enum(['always', 'focused', 'never']).default('always'),
  showDeletedMessages: z.enum(['cross-out', 'hide']).default('cross-out'),
  showReplyContext: z.boolean().default(true),
  pauseScrollOnHover: z.boolean().default(false),
  showConnectionAlerts: z.boolean().default(true),
  hideCommands: z.boolean().default(false),
  flashOnMention: z.boolean().default(true),
  keywordAlerts: z.array(z.string()).default([]),
  mentionKeywords: z.array(z.string()).default([]),
  maxMessagesPerChannel: z.number().min(100).max(50000).default(5000),
  modButtons: z.object({
    showDelete: z.boolean().default(true),
    showTimeout: z.boolean().default(true),
    showBan: z.boolean().default(true),
    timeoutPresets: z.array(z.number()).default([60, 600, 3600, 86400])
  }).default({}),
  windowBounds: z.object({
    x: z.number().nullable().default(null),
    y: z.number().nullable().default(null),
    width: z.number().default(420),
    height: z.number().default(900)
  }).default({})
})

class SettingsStore {
  private store: Store<AppSettings>

  constructor() {
    this.store = new Store<AppSettings>({
      name: 'settings',
      defaults: DEFAULT_SETTINGS
    })
  }

  get(): AppSettings {
    return {
      channels: this.store.get('channels', DEFAULT_SETTINGS.channels),
      twitchClientId: this.store.get('twitchClientId', ''),
      twitchClientSecret: this.store.get('twitchClientSecret', ''),
      googleClientId: this.store.get('googleClientId', ''),
      youtubeApiKey: this.store.get('youtubeApiKey', ''),
      theme: this.store.get('theme', 'dark'),
      fontSize: this.store.get('fontSize', 14),
      showTimestamps: this.store.get('showTimestamps', true),
      timestampFormat: this.store.get('timestampFormat', '24h'),
      showBadges: this.store.get('showBadges', true),
      showPlatformBadge: this.store.get('showPlatformBadge', true),
      emoteScale: this.store.get('emoteScale', 1.5),
      messageSpacing: this.store.get('messageSpacing', 'normal'),
      alternatingRows: this.store.get('alternatingRows', false),
      usernameDisplay: this.store.get('usernameDisplay', 'display-name'),
      enabledProviders: this.store.get('enabledProviders', DEFAULT_SETTINGS.enabledProviders),
      animateEmotes: this.store.get('animateEmotes', 'always'),
      showDeletedMessages: this.store.get('showDeletedMessages', 'cross-out'),
      showReplyContext: this.store.get('showReplyContext', true),
      pauseScrollOnHover: this.store.get('pauseScrollOnHover', false),
      showConnectionAlerts: this.store.get('showConnectionAlerts', true),
      hideCommands: this.store.get('hideCommands', false),
      flashOnMention: this.store.get('flashOnMention', true),
      keywordAlerts: this.store.get('keywordAlerts', []),
      mentionKeywords: this.store.get('mentionKeywords', []),
      maxMessagesPerChannel: this.store.get('maxMessagesPerChannel', 5000),
      modButtons: this.store.get('modButtons', DEFAULT_SETTINGS.modButtons),
      windowBounds: this.store.get('windowBounds', DEFAULT_SETTINGS.windowBounds)
    }
  }

  set(partial: Partial<AppSettings>): AppSettings {
    const merged = { ...this.get(), ...partial }
    const validated = settingsSchema.parse(merged)
    for (const [key, value] of Object.entries(validated)) {
      this.store.set(key, value)
    }
    return validated as AppSettings
  }

  setWindowBounds(bounds: AppSettings['windowBounds']): void {
    this.store.set('windowBounds', bounds)
  }
}

export const settingsStore = new SettingsStore()
