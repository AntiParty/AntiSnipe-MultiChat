import { useMemo } from 'react'
import { useStore } from '../store'
import type { NormalizedMessage } from '@shared/types/message'

const EMPTY: NormalizedMessage[] = []

export function useMessages(channelId: string): NormalizedMessage[] {
  // For a specific channel, subscribe only to that channel's array.
  // Immer only creates a new array reference when that specific channel is
  // mutated, so other channels receiving messages won't trigger a re-render here.
  // For the "all" feed we must subscribe to the full map since any channel update
  // needs to flow through.
  const data = useStore(s =>
    channelId === 'all'
      ? s.messagesByChannel
      : (s.messagesByChannel[channelId] ?? EMPTY)
  )

  return useMemo(() => {
    if (channelId === 'all') {
      const byChannel = data as Record<string, NormalizedMessage[]>
      // Take only the tail of each channel's buffer before merging so the
      // combined sort stays cheap even when many channels are active.
      const PER_CHANNEL_CAP = 500
      const all: NormalizedMessage[] = []
      for (const msgs of Object.values(byChannel)) {
        const slice = msgs.length > PER_CHANNEL_CAP ? msgs.slice(msgs.length - PER_CHANNEL_CAP) : msgs
        all.push(...slice)
      }
      all.sort((a, b) => a.timestamp - b.timestamp)
      return all
    }
    return data as NormalizedMessage[]
  }, [data, channelId])
}

export function useActiveMessages(): NormalizedMessage[] {
  const activeChannelId = useStore(s => s.activeChannelId)
  return useMessages(activeChannelId)
}
