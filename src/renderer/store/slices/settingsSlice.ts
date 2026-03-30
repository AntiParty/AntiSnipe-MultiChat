import type { StateCreator } from 'zustand'
import type { AppSettings } from '@shared/types/settings'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

export interface SettingsSlice {
  settings: AppSettings
  settingsOpen: boolean

  hydrateSettings: (settings: AppSettings) => void
  updateSettings: (partial: Partial<AppSettings>) => void
  openSettings: () => void
  closeSettings: () => void
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [['zustand/immer', never]],
  [],
  SettingsSlice
> = set => ({
  settings: DEFAULT_SETTINGS,
  settingsOpen: false,

  hydrateSettings: settings => {
    set(state => {
      state.settings = settings
    })
  },

  updateSettings: partial => {
    set(state => {
      Object.assign(state.settings, partial)
    })
  },

  openSettings: () => {
    set(state => {
      state.settingsOpen = true
    })
  },

  closeSettings: () => {
    set(state => {
      state.settingsOpen = false
    })
  }
})
