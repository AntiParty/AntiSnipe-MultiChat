import type { Platform, BadgeInfo } from './message'

export type ViewerRole = 'broadcaster' | 'mod' | 'vip' | 'sub' | 'viewer'

export interface ViewerEntry {
  userId: string          // authorId from messages; empty string for API-only lurkers
  login: string
  displayName: string
  platform: Platform
  role: ViewerRole
  isMod: boolean
  isVip: boolean
  isSub: boolean
  isBroadcaster: boolean
  badges: BadgeInfo[]
  color: string | null
  messageCount: number
  lastSeenAt: number      // Date.now() of last message; 0 for API-only entries
  fromApi: boolean
}

export interface ViewerListPayload {
  channelId: string
  viewers: ViewerEntry[]
  totalCount: number      // Helix total_count if from API, else viewers.length
  isApiData: boolean
}
