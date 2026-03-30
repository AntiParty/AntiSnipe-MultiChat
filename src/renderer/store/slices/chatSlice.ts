import type { StateCreator } from 'zustand'
import type { NormalizedMessage, DeleteMessageEvent } from '@shared/types/message'
import { MAX_MESSAGES_PER_CHANNEL, TRIM_AMOUNT } from '@shared/constants'

export interface ChatSlice {
  messagesByChannel: Record<string, NormalizedMessage[]>
  activeChannelId: string
  unreadCounts: Record<string, number>

  addMessages: (messages: NormalizedMessage[]) => void
  deleteMessage: (event: DeleteMessageEvent) => void
  setActiveChannel: (channelId: string) => void
  clearChannel: (channelId: string) => void
  resetUnread: (channelId: string) => void
}

export const createChatSlice: StateCreator<ChatSlice, [['zustand/immer', never]], [], ChatSlice> = (
  set
) => ({
  messagesByChannel: { all: [] },
  activeChannelId: 'all',
  unreadCounts: {},

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
  }
})
