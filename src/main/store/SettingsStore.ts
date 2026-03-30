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
  showBadges: z.boolean().default(true),
  showPlatformBadge: z.boolean().default(true),
  emoteScale: z.number().min(0.5).max(3).default(1.5),
  enabledProviders: z.object({
    sevenTv: z.boolean().default(true),
    bttv: z.boolean().default(true),
    ffz: z.boolean().default(true)
  }).default({}),
  keywordAlerts: z.array(z.string()).default([]),
  mentionKeywords: z.array(z.string()).default([]),
  maxMessagesPerChannel: z.number().min(100).max(50000).default(5000),
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
      showBadges: this.store.get('showBadges', true),
      showPlatformBadge: this.store.get('showPlatformBadge', true),
      emoteScale: this.store.get('emoteScale', 1.5),
      enabledProviders: this.store.get('enabledProviders', DEFAULT_SETTINGS.enabledProviders),
      keywordAlerts: this.store.get('keywordAlerts', []),
      mentionKeywords: this.store.get('mentionKeywords', []),
      maxMessagesPerChannel: this.store.get('maxMessagesPerChannel', 5000),
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
