import { RENDERER_CHANNELS, MAIN_CHANNELS } from '@shared/types/ipc'
import { ensureTauriBridgeInstalled } from '../../services/tauriBridge'
import { useStore } from '../index'

/**
 * Subscribe to IPC push events from the main process and dispatch them to
 * the Zustand store. Returns a cleanup function.
 */
export function initIpcSync(): () => void {
  const bridge = ensureTauriBridgeInstalled()
  const unsubscribers: Array<() => void> = []

  // Load initial settings
  bridge.invoke('settings:get').then(settings => {
    useStore.getState().hydrateSettings(settings)
    useStore.getState().setChannels(settings.channels)
    if (settings.showViewerList) {
      useStore.getState().openViewerList()
    }
  })

  // Load initial auth state
  bridge.invoke('auth:getState').then(auth => {
    useStore.getState().hydrateAuth(auth)
  })

  // Load initial connection states, then pull any cached recent messages
  bridge.invoke('connections:getAll').then(async states => {
    for (const state of states) {
      useStore.getState().updateConnectionState(state)
    }
    // Pull recent messages for channels connected before the renderer loaded
    for (const state of states) {
      if (state.status === 'connected') {
        try {
          const msgs = await bridge.invoke('chat:getRecentMessages', { channelId: state.channelId })
          if (msgs.length > 0) {
            useStore.getState().prependMessages(state.channelId, msgs)
          }
        } catch { /* ignore */ }
        try {
          const vl = await bridge.invoke(MAIN_CHANNELS.GET_VIEWER_LIST, { channelId: state.channelId })
          if (vl) useStore.getState().setViewerList(vl)
        } catch { /* ignore */ }
      }
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

  // Update notifications
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.UPDATE_AVAILABLE, ({ version }) => {
      useStore.getState().setUpdateStatus({ available: version, checking: false, error: null })
    })
  )

  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.UPDATE_DOWNLOADED, ({ version }) => {
      useStore.getState().setUpdateStatus({ downloaded: version, checking: false, error: null })
    })
  )

  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.UPDATE_NOT_AVAILABLE, () => {
      useStore.getState().setUpdateStatus({ checking: false, error: null })
    })
  )

  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.UPDATE_ERROR, ({ message }) => {
      useStore.getState().setUpdateStatus({ checking: false, error: message })
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

  // Recent messages — prepended to channel buffer when fetched on connect
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.RECENT_MESSAGES, ({ channelId, messages }) => {
      useStore.getState().prependMessages(channelId, messages)
    })
  )

  // Viewer list updates pushed from main process (Twitch chatter poller)
  unsubscribers.push(
    bridge.on(RENDERER_CHANNELS.VIEWER_LIST_UPDATE, payload => {
      useStore.getState().setViewerList(payload)
    })
  )

  // Viewer count polling — fetches every 60s unconditionally
  const pollViewerCounts = () => {
    bridge.invoke('streams:viewerCounts').then(counts => {
      useStore.getState().setViewerCounts(counts)
    }).catch(() => {})
  }
  pollViewerCounts()
  const viewerCountTimer = setInterval(pollViewerCounts, 60_000)

  return () => {
    clearInterval(viewerCountTimer)
    for (const unsub of unsubscribers) unsub()
  }
}
