import { useCallback } from 'react'
import { useStore } from '../store'
import type { AppSettings } from '@shared/types/settings'

export function useSettings() {
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)

  const save = useCallback(
    async (partial: Partial<AppSettings>) => {
      // Optimistic update
      updateSettings(partial)
      // Persist via IPC
      try {
        const updated = await window.chatBridge.invoke('settings:set', partial)
        updateSettings(updated)
      } catch (err) {
        console.error('Failed to save settings:', err)
      }
    },
    [updateSettings]
  )

  return { settings, save }
}
