import { useMemo } from 'react'
import { useStore } from '../store'
import type { NormalizedMessage } from '@shared/types/message'

export function useMessages(channelId: string): NormalizedMessage[] {
  const messagesByChannel = useStore(s => s.messagesByChannel)

  return useMemo(() => {
    if (channelId === 'all') {
      // Merge all channels sorted by timestamp
      const all: NormalizedMessage[] = []
      for (const msgs of Object.values(messagesByChannel)) {
        all.push(...msgs)
      }
      all.sort((a, b) => a.timestamp - b.timestamp)
      return all
    }
    return messagesByChannel[channelId] ?? []
  }, [messagesByChannel, channelId])
}

export function useActiveMessages(): NormalizedMessage[] {
  const activeChannelId = useStore(s => s.activeChannelId)
  return useMessages(activeChannelId)
}
