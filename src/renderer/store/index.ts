import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatSlice } from './slices/chatSlice'
import type { ChannelsSlice } from './slices/channelsSlice'
import type { SettingsSlice } from './slices/settingsSlice'
import type { AuthSlice } from './slices/authSlice'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

export type RootState = ChatSlice & ChannelsSlice & SettingsSlice & AuthSlice

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetState = (fn: (state: RootState) => void) => void
type GetState = () => RootState

function buildChatSlice(set: SetState): ChatSlice {
  const MAX = 5000
  const TRIM = 1000
  return {
    messagesByChannel: {},
    activeChannelId: 'all',
    unreadCounts: {},
    addMessages: messages =>
      set(state => {
        for (const msg of messages) {
          const { channelId } = msg
          if (!state.messagesByChannel[channelId]) state.messagesByChannel[channelId] = []
          state.messagesByChannel[channelId].push(msg)
          if (state.messagesByChannel[channelId].length > MAX) {
            state.messagesByChannel[channelId].splice(0, TRIM)
          }
          if (state.activeChannelId !== channelId && state.activeChannelId !== 'all') {
            state.unreadCounts[channelId] = (state.unreadCounts[channelId] ?? 0) + 1
          }
        }
      }),
    deleteMessage: event =>
      set(state => {
        const { channelId, messageId, authorId } = event
        const buckets = channelId ? [channelId] : Object.keys(state.messagesByChannel)
        for (const cid of buckets) {
          for (const msg of state.messagesByChannel[cid] ?? []) {
            if ((messageId && msg.id === messageId) || (authorId && msg.authorId === authorId)) {
              msg.isDeleted = true
            }
          }
        }
      }),
    setActiveChannel: channelId =>
      set(state => {
        state.activeChannelId = channelId
        state.unreadCounts[channelId] = 0
      }),
    clearChannel: channelId =>
      set(state => {
        state.messagesByChannel[channelId] = []
        state.unreadCounts[channelId] = 0
      }),
    resetUnread: channelId =>
      set(state => {
        state.unreadCounts[channelId] = 0
      })
  }
}

function buildChannelsSlice(set: SetState): ChannelsSlice {
  return {
    channels: [],
    connectionStates: {},
    setChannels: channels => set(state => { state.channels = channels }),
    addChannel: channel =>
      set(state => {
        const idx = state.channels.findIndex(c => c.id === channel.id)
        if (idx === -1) state.channels.push(channel)
        else state.channels[idx] = channel
      }),
    removeChannel: channelId =>
      set(state => {
        state.channels = state.channels.filter(c => c.id !== channelId)
        delete state.connectionStates[channelId]
      }),
    updateConnectionState: cs =>
      set(state => { state.connectionStates[cs.channelId] = cs })
  }
}

function buildSettingsSlice(set: SetState): SettingsSlice {
  return {
    settings: DEFAULT_SETTINGS,
    settingsOpen: false,
    hydrateSettings: settings => set(state => { state.settings = settings }),
    updateSettings: partial => set(state => { Object.assign(state.settings, partial) }),
    openSettings: () => set(state => { state.settingsOpen = true }),
    closeSettings: () => set(state => { state.settingsOpen = false })
  }
}

function buildAuthSlice(set: SetState): AuthSlice {
  return {
    auth: {
      twitch: { status: 'unauthenticated' },
      youtube: { status: 'unauthenticated' }
    },
    updateAuthState: (platform, authState) =>
      set(state => { state.auth[platform] = authState }),
    hydrateAuth: auth => set(state => { state.auth = auth })
  }
}

export const useStore = create<RootState>()(
  immer((set, _get) => {
    const s = set as unknown as SetState
    return {
      ...buildChatSlice(s),
      ...buildChannelsSlice(s),
      ...buildSettingsSlice(s),
      ...buildAuthSlice(s)
    }
  })
)
