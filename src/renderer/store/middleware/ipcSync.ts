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

  // Hydrate mod status — the SELF_MOD_STATUS push event fires during the initial
  // Twitch JOIN, before the renderer's IPC listener is registered, so we fetch
  // the current statuses explicitly on startup.
  bridge.invoke('mod:getSelfStatuses').then(statuses => {
    for (const [channelId, isMod] of Object.entries(statuses)) {
      useStore.getState().setSelfModStatus(channelId, isMod)
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

      // Re-connect all channels for this platform once authentication succeeds.
      // This handles both first-time auth (upgrade from anonymous) and
      // re-auth after logout — in both cases the main process service has
      // been reset and needs to re-join channels with fresh credentials.
      if (state.status === 'authenticated') {
        const { channels } = useStore.getState()
        for (const ch of channels) {
          if (ch.platform === platform && ch.enabled) {
            bridge.invoke('channel:connect', {
              channelId: ch.id,
              platform: ch.platform,
              slug: ch.slug
            }).catch(() => {})
          }
        }
      }
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

  // Emote batch ready — retroactively tokenize messages with loaded emotes
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.EMOTE_BATCH_READY, ({ channelId, emotes }) => {
      useStore.getState().setChannelEmotes(channelId, emotes)
    })
  )

  // Self mod status — track if connected user is mod/broadcaster in each channel
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.SELF_MOD_STATUS, ({ channelId, isMod }) => {
      useStore.getState().setSelfModStatus(channelId, isMod)
    })
  )

  return () => {
    for (const unsub of unsubscribers) unsub()
  }
}
