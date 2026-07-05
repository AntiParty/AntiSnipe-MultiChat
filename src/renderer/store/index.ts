import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatSlice, ChatterInfo } from './slices/chatSlice'
import type { ChannelsSlice } from './slices/channelsSlice'
import type { SettingsSlice } from './slices/settingsSlice'
import type { AuthSlice } from './slices/authSlice'
import type { ViewerSlice } from './slices/viewerSlice'
import type { ViewerEntry, ViewerListPayload } from '@shared/types/viewer'
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

function deriveViewerRole(msg: NormalizedMessage): import('@shared/types/viewer').ViewerRole {
  // Prefer raw badge IDs from the IRC tag — resolved badges disappear when
  // badge images aren't cached (e.g. anonymous connection), which used to
  // dump every mod/sub into the "Viewers" bucket
  const ids = msg.badgeIds ?? msg.badges.map(b => b.id)
  if (ids.includes('broadcaster')) return 'broadcaster'
  if (ids.includes('moderator')) return 'mod'
  if (ids.includes('vip')) return 'vip'
  if (ids.includes('subscriber') || ids.includes('founder')) return 'sub'
  return 'viewer'
}

// Viewer-list hygiene: message-derived entries fade out after inactivity and
// the list is capped so an hours-long session doesn't accumulate everyone
// who ever said a word.
const VIEWER_INACTIVE_MS = 15 * 60 * 1000
const MAX_VIEWER_ENTRIES = 800

export interface UpdateStatus {
  checking: boolean
  available: string | null   // version string if update available but not yet downloaded
  downloaded: string | null  // version string if downloaded and ready to install
  error: string | null
}

export type RootState = ChatSlice & ChannelsSlice & SettingsSlice & AuthSlice & ViewerSlice & {
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
    streamInfoByChannel: {},
    pinnedByChannel: {},
    addMessages: messages =>
      set(state => {
        for (const msg of messages) {
          const { channelId } = msg

          // IRC echo of our own message: swap it in for the optimistic
          // 'self-…' row so the message gains its real ID (delete/pin need it)
          if (msg.isSelfEcho) {
            const bucket = state.messagesByChannel[channelId]
            let replaced = false
            if (bucket) {
              for (let i = bucket.length - 1; i >= 0 && i >= bucket.length - 20; i--) {
                const sameId = bucket[i].id === msg.id
                const sameOptimistic =
                  bucket[i].id.startsWith('self-') &&
                  bucket[i].raw === msg.raw &&
                  bucket[i].authorName.toLowerCase() === msg.authorName.toLowerCase()
                if (sameId || sameOptimistic) {
                  bucket[i] = msg
                  replaced = true
                  break
                }
              }
            }
            if (replaced) continue
            // No optimistic row found (e.g. sent from another window) — fall
            // through and append like a normal message
          }
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

            // Update viewer list tracking
            if (!state.viewersByChannel[channelId]) {
              state.viewersByChannel[channelId] = []
            }
            const viewers = state.viewersByChannel[channelId]
            const vi = viewers.findIndex((v: ViewerEntry) => v.login === msg.authorName)
            const role = deriveViewerRole(msg)
            if (vi !== -1) {
              viewers[vi].messageCount++
              viewers[vi].lastSeenAt = msg.timestamp
              viewers[vi].displayName = msg.authorDisplayName
              viewers[vi].badges = msg.badges
              viewers[vi].color = msg.authorColor
              viewers[vi].role = role
              viewers[vi].isMod = role === 'mod' || role === 'broadcaster'
              viewers[vi].isVip = role === 'vip'
              viewers[vi].isSub = role === 'sub' || role === 'broadcaster'
              viewers[vi].isBroadcaster = role === 'broadcaster'
            } else {
              viewers.push({
                userId: msg.authorId,
                login: msg.authorName,
                displayName: msg.authorDisplayName,
                platform: msg.platform,
                role,
                isMod: role === 'mod' || role === 'broadcaster',
                isVip: role === 'vip',
                isSub: role === 'sub' || role === 'broadcaster',
                isBroadcaster: role === 'broadcaster',
                badges: msg.badges,
                color: msg.authorColor,
                messageCount: 1,
                lastSeenAt: msg.timestamp,
                fromApi: false
              })
            }
            // Cap the list: evict the least-recently-seen message-derived entries
            if (viewers.length > MAX_VIEWER_ENTRIES) {
              const sorted = [...viewers].sort((a, b) => {
                if (a.fromApi !== b.fromApi) return a.fromApi ? -1 : 1
                return b.lastSeenAt - a.lastSeenAt
              })
              state.viewersByChannel[channelId] = sorted.slice(0, MAX_VIEWER_ENTRIES)
            }
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
    setStreamInfo: info =>
      set(state => { state.streamInfoByChannel = info }),
    setPinnedMessage: (channelId, pinned) =>
      set(state => { state.pinnedByChannel[channelId] = pinned }),
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
        delete state.viewersByChannel[channelId]
        delete state.viewerTotalByChannel[channelId]
        delete state.viewerIsApiByChannel[channelId]
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

function buildViewerSlice(set: SetState): ViewerSlice {
  return {
    viewersByChannel: {},
    viewerTotalByChannel: {},
    viewerIsApiByChannel: {},
    viewerListOpen: false,
    setViewerList: (payload: ViewerListPayload) =>
      set(state => {
        const { channelId, viewers, totalCount, isApiData } = payload
        if (isApiData) {
          // The API list is authoritative: keep API-confirmed chatters plus
          // anyone who spoke recently, dropping stale message-derived entries
          // (people who left used to linger in the list forever)
          const existing = state.viewersByChannel[channelId] ?? []
          const apiLogins = new Set(viewers.map((v: ViewerEntry) => v.login))
          const cutoff = Date.now() - VIEWER_INACTIVE_MS
          const byLogin = new Map<string, ViewerEntry>()
          for (const v of existing) {
            if (apiLogins.has(v.login) || v.lastSeenAt > cutoff) byLogin.set(v.login, v)
          }
          for (const apiEntry of viewers) {
            const known = byLogin.get(apiEntry.login)
            if (known) {
              // Keep message-derived role/badges/color/messageCount, just mark as seen in API
              known.fromApi = true
              known.userId = known.userId || apiEntry.userId
            } else {
              byLogin.set(apiEntry.login, apiEntry)
            }
          }
          state.viewersByChannel[channelId] = Array.from(byLogin.values())
        } else {
          // Message-derived push — handled inline in addMessages; just update meta
          if (!state.viewersByChannel[channelId]) state.viewersByChannel[channelId] = []
        }
        state.viewerTotalByChannel[channelId] = totalCount
        state.viewerIsApiByChannel[channelId] = isApiData
      }),
    toggleViewerList: () =>
      set(state => { state.viewerListOpen = !state.viewerListOpen }),
    openViewerList: () =>
      set(state => { state.viewerListOpen = true }),
    closeViewerList: () =>
      set(state => { state.viewerListOpen = false })
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
      ...buildViewerSlice(s),
      windowFocused: true,
      setWindowFocused: (v: boolean) => set(state => { (state as RootState).windowFocused = v }),
      updateStatus: { checking: false, available: null, downloaded: null, error: null },
      setUpdateStatus: (patch: Partial<UpdateStatus>) =>
        set(state => { Object.assign((state as RootState).updateStatus, patch) })
    }
  })
)
