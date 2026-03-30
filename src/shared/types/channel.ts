import type { Platform } from './message'

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'ended'

export interface ChannelConfig {
  id: string           // internal unique key, e.g. "twitch:xqc"
  platform: Platform
  slug: string         // channel username/handle
  displayName: string  // shown in UI
  enabled: boolean
}

export interface ConnectionState {
  channelId: string
  status: ConnectionStatus
  error?: string
  connectedAt?: number
  reconnectAttempt?: number
}

export interface ConnectChannelPayload {
  channelId: string
  platform: Platform
  slug: string
}

export interface DisconnectChannelPayload {
  channelId: string
}
