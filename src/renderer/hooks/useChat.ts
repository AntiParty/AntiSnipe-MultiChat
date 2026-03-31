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
      const all: NormalizedMessage[] = []
      for (const msgs of Object.values(byChannel)) {
        all.push(...msgs)
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
