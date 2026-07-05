import type { StateCreator } from 'zustand'
import type { NormalizedMessage, MessagePart, DeleteMessageEvent } from '@shared/types/message'
import type { StreamInfo, PinnedMessage } from '@shared/types/ipc'
import type { EmoteData } from '@shared/types/emote'
import { MAX_MESSAGES_PER_CHANNEL, TRIM_AMOUNT } from '@shared/constants'

export interface ChatterInfo {
  login: string
  displayName: string
}

export interface ChatSlice {
  messagesByChannel: Record<string, NormalizedMessage[]>
  emotesByChannel: Record<string, Record<string, EmoteData>>
  selfModByChannel: Record<string, boolean>
  // Recent chatters per channel: ordered array, newest at end, capped at MAX_CHATTERS
  chattersByChannel: Record<string, ChatterInfo[]>
  activeChannelId: string
  unreadCounts: Record<string, number>
  viewerCountsByChannel: Record<string, number>
  streamInfoByChannel: Record<string, StreamInfo>
  pinnedByChannel: Record<string, PinnedMessage | null>

  addMessages: (messages: NormalizedMessage[]) => void
  prependMessages: (channelId: string, messages: NormalizedMessage[]) => void
  deleteMessage: (event: DeleteMessageEvent) => void
  setActiveChannel: (channelId: string) => void
  clearChannel: (channelId: string) => void
  resetUnread: (channelId: string) => void
  setChannelEmotes: (channelId: string, emotes: EmoteData[]) => void
  setSelfModStatus: (channelId: string, isMod: boolean) => void
  setViewerCounts: (counts: Record<string, number>) => void
  setStreamInfo: (info: Record<string, StreamInfo>) => void
  setPinnedMessage: (channelId: string, pinned: PinnedMessage | null) => void
}

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

export const createChatSlice: StateCreator<ChatSlice, [['zustand/immer', never]], [], ChatSlice> = (
  set
) => ({
  messagesByChannel: { all: [] },
  emotesByChannel: {},
  selfModByChannel: {},
  chattersByChannel: {},
  activeChannelId: 'all',
  unreadCounts: {},
  viewerCountsByChannel: {},
  streamInfoByChannel: {},
  pinnedByChannel: {},

  addMessages: messages => {
    set(state => {
      for (const msg of messages) {
        const { channelId } = msg

        // Per-channel bucket
        if (!state.messagesByChannel[channelId]) {
          state.messagesByChannel[channelId] = []
        }
        state.messagesByChannel[channelId].push(msg)

        // Trim if over limit
        const maxPer = MAX_MESSAGES_PER_CHANNEL
        if (state.messagesByChannel[channelId].length > maxPer) {
          state.messagesByChannel[channelId].splice(0, TRIM_AMOUNT)
        }

        // Unread count for non-active channels
        if (state.activeChannelId !== channelId && state.activeChannelId !== 'all') {
          state.unreadCounts[channelId] = (state.unreadCounts[channelId] ?? 0) + 1
        }
      }
    })
  },

  deleteMessage: event => {
    set(state => {
      const { channelId, messageId, authorId } = event
      const channels = channelId ? [channelId] : Object.keys(state.messagesByChannel)

      for (const cid of channels) {
        const arr = state.messagesByChannel[cid]
        if (!arr) continue
        for (const msg of arr) {
          if (messageId && msg.id === messageId) {
            msg.isDeleted = true
          } else if (authorId && msg.authorId === authorId) {
            msg.isDeleted = true
          }
        }
      }
    })
  },

  setActiveChannel: channelId => {
    set(state => {
      state.activeChannelId = channelId
      state.unreadCounts[channelId] = 0
    })
  },

  clearChannel: channelId => {
    set(state => {
      state.messagesByChannel[channelId] = []
      state.unreadCounts[channelId] = 0
    })
  },

  resetUnread: channelId => {
    set(state => {
      state.unreadCounts[channelId] = 0
    })
  },

  setSelfModStatus: (channelId, isMod) => {
    set(state => { state.selfModByChannel[channelId] = isMod })
  },

  setViewerCounts: counts => {
    set(state => { state.viewerCountsByChannel = counts })
  },

  setStreamInfo: info => {
    set(state => { state.streamInfoByChannel = info })
  },

  setPinnedMessage: (channelId, pinned) => {
    set(state => { state.pinnedByChannel[channelId] = pinned })
  },

  prependMessages: (channelId, messages) => {
    set(state => {
      const existing = state.messagesByChannel[channelId] ?? []
      const existingIds = new Set(existing.map(m => m.id))
      const fresh = messages.filter(m => !existingIds.has(m.id))
      if (fresh.length > 0) {
        state.messagesByChannel[channelId] = [...fresh, ...existing]
      }
    })
  },

  setChannelEmotes: (channelId, emotes) => {
    set(state => {
      // Build name → EmoteData map, higher-priority provider wins on collision
      const sorted = [...emotes].sort((a, b) => emotePriority(a.provider) - emotePriority(b.provider))
      const map: Record<string, EmoteData> = {}
      for (const e of sorted) map[e.name] = e
      state.emotesByChannel[channelId] = map

      // Retroactively fix messages that arrived before emotes were loaded
      const msgs = state.messagesByChannel[channelId]
      if (!msgs) return
      for (const msg of msgs) {
        msg.parts = retokenizeParts(msg.parts, map) as typeof msg.parts
      }
    })
  }
})
