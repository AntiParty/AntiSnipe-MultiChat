import type { StateCreator } from 'zustand'
import type { ChannelConfig, ConnectionState, ConnectionStatus } from '@shared/types/channel'

export interface ChannelsSlice {
  channels: ChannelConfig[]
  connectionStates: Record<string, ConnectionState>

  setChannels: (channels: ChannelConfig[]) => void
  addChannel: (channel: ChannelConfig) => void
  removeChannel: (channelId: string) => void
  updateConnectionState: (state: ConnectionState) => void
}

export const createChannelsSlice: StateCreator<
  ChannelsSlice,
  [['zustand/immer', never]],
  [],
  ChannelsSlice
> = set => ({
  channels: [],
  connectionStates: {},

  setChannels: channels => {
    set(state => {
      state.channels = channels
    })
  },

  addChannel: channel => {
    set(state => {
      const idx = state.channels.findIndex(c => c.id === channel.id)
      if (idx === -1) {
        state.channels.push(channel)
      } else {
        state.channels[idx] = channel
      }
    })
  },

  removeChannel: channelId => {
    set(state => {
      state.channels = state.channels.filter(c => c.id !== channelId)
      delete state.connectionStates[channelId]
    })
  },

  updateConnectionState: connectionState => {
    set(state => {
      state.connectionStates[connectionState.channelId] = connectionState
    })
  }
})
