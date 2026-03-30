import { RENDERER_CHANNELS } from '@shared/types/ipc'
import { useStore } from '../index'

/**
 * Subscribe to IPC push events from the main process and dispatch them to
 * the Zustand store. Returns a cleanup function.
 */
export function initIpcSync(): () => void {
  const bridge = window.chatBridge
  const unsubscribers: Array<() => void> = []

  // Load initial settings
  bridge.invoke('settings:get').then(settings => {
    useStore.getState().hydrateSettings(settings)
    useStore.getState().setChannels(settings.channels)
  })

  // Load initial auth state
  bridge.invoke('auth:getState').then(auth => {
    useStore.getState().hydrateAuth(auth)
  })

  // Load initial connection states
  bridge.invoke('connections:getAll').then(states => {
    for (const state of states) {
      useStore.getState().updateConnectionState(state)
    }
  })

  // Incoming chat messages
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.MESSAGE_BATCH, messages => {
      useStore.getState().addMessages(messages)
    })
  )

  // Message deletions
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.DELETE_MESSAGE, event => {
      useStore.getState().deleteMessage(event)
    })
  )

  // Connection state changes
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.CONNECTION_STATE, state => {
      useStore.getState().updateConnectionState(state)
    })
  )

  // Auth state changes
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.AUTH_STATE_CHANGED, ({ platform, state }) => {
      useStore.getState().updateAuthState(platform, state)
    })
  )

  // Settings updated from main process
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.SETTINGS_UPDATED, settings => {
      useStore.getState().hydrateSettings(settings)
      useStore.getState().setChannels(settings.channels)
    })
  )

  // Update notifications — handled by StatusBar via store
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.UPDATE_AVAILABLE, ({ version }) => {
      useStore.getState().updateSettings({ _updateAvailable: version } as any)
    })
  )

  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.UPDATE_DOWNLOADED, ({ version }) => {
      useStore.getState().updateSettings({ _updateDownloaded: version } as any)
    })
  )

  return () => {
    for (const unsub of unsubscribers) unsub()
  }
}
