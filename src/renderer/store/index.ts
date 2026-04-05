import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatSlice, ChatterInfo } from './slices/chatSlice'
import type { ChannelsSlice } from './slices/channelsSlice'
import type { SettingsSlice } from './slices/settingsSlice'
import type { AuthSlice } from './slices/authSlice'
import type { EmoteData } from '@shared/types/emote'
import type { NormalizedMessage, MessagePart } from '@shared/types/message'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

function emotePriority(provider: EmoteData['provider']): number {
  const p: Record<string, number> = { '7tv': 4, bttv: 3, ffz: 2, twitch: 1, kick: 1 }
  return p[provider] ?? 0
}

function retokenizeParts(parts: MessagePart[], emoteMap: Record<string, EmoteData>): MessagePart[] {
  const result: MessagePart[] = []
  for (const part of parts) {
    if (part.type !== 'text') { result.push(part); continue }
    const words = part.content.split(/(\s+)/)
    for (const word of words) {
      if (!word) continue
      const emote = emoteMap[word.trim()]
      if (emote && word.trim() === word) {
        result.push({ type: 'emote', emote })
      } else {
        result.push({ type: 'text', content: word })
      }
    }
  }
  return result
}

// Keep only the N most-recently-seen chatters per channel
const MAX_CHATTERS = 500

export interface UpdateStatus {
  checking: boolean
  available: string | null   // version string if update available but not yet downloaded
  downloaded: string | null  // version string if downloaded and ready to install
  error: string | null
}

export type RootState = ChatSlice & ChannelsSlice & SettingsSlice & AuthSlice & {
  windowFocused: boolean
  setWindowFocused: (v: boolean) => void
  updateStatus: UpdateStatus
  setUpdateStatus: (patch: Partial<UpdateStatus>) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetState = (fn: (state: RootState) => void) => void
type GetState = () => RootState

function buildChatSlice(set: SetState): ChatSlice {
  const MAX = 2000
  const TRIM = 500
  return {
    messagesByChannel: {},
    emotesByChannel: {},
    selfModByChannel: {},
    chattersByChannel: {},
    activeChannelId: 'all',
    unreadCounts: {},
    viewerCountsByChannel: {},
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
          // Track chatters for @ autocomplete (skip system messages)
          if (msg.authorName && (msg.messageType === 'chat' || msg.messageType === 'action')) {
            if (!state.chattersByChannel[channelId]) {
              state.chattersByChannel[channelId] = []
            }
            const arr = state.chattersByChannel[channelId]
            // Move to end (most recent) by removing old entry then appending
            const idx = arr.findIndex(c => c.login === msg.authorName)
            if (idx !== -1) arr.splice(idx, 1)
            arr.push({ login: msg.authorName, displayName: msg.authorDisplayName })
            // Evict oldest entry if over cap
            if (arr.length > MAX_CHATTERS) arr.splice(0, 1)
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
      }),
    setSelfModStatus: (channelId, isMod) =>
      set(state => { state.selfModByChannel[channelId] = isMod }),
    setViewerCounts: counts =>
      set(state => { state.viewerCountsByChannel = counts }),
    prependMessages: (channelId, messages) =>
      set(state => {
        const existing = state.messagesByChannel[channelId] ?? []
        const existingIds = new Set(existing.map((m: NormalizedMessage) => m.id))
        const fresh = messages.filter((m: NormalizedMessage) => !existingIds.has(m.id))
        if (fresh.length > 0) {
          state.messagesByChannel[channelId] = [...fresh, ...existing]
        }
        // No unread increment for historical messages
      }),
    setChannelEmotes: (channelId, emotes) =>
      set(state => {
        const sorted = [...emotes].sort((a, b) => emotePriority(a.provider) - emotePriority(b.provider))
        const map: Record<string, EmoteData> = {}
        for (const e of sorted) map[e.name] = e
        state.emotesByChannel[channelId] = map
        const msgs = state.messagesByChannel[channelId]
        if (!msgs) return
        for (const msg of msgs) {
          msg.parts = retokenizeParts(msg.parts, map) as typeof msg.parts
        }
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
        delete state.viewerCountsByChannel[channelId]
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
      ...buildAuthSlice(s),
      windowFocused: true,
      setWindowFocused: (v: boolean) => set(state => { (state as RootState).windowFocused = v }),
      updateStatus: { checking: false, available: null, downloaded: null, error: null },
      setUpdateStatus: (patch: Partial<UpdateStatus>) =>
        set(state => { Object.assign((state as RootState).updateStatus, patch) })
    }
  })
)
