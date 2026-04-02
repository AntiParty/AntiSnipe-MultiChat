import type { EmoteData } from './emote'
import type { PluginAction } from './plugin'

export type Platform = 'twitch' | 'youtube' | 'kick' | 'tiktok'

export type MessageType =
  | 'chat'        // normal message
  | 'action'      // /me message
  | 'sub'         // subscription
  | 'resub'       // resubscription
  | 'giftsub'     // gifted sub
  | 'raid'        // raid notification
  | 'announcement'// channel announcement
  | 'system'      // internal system message (e.g. "Connected to #channel")
  | 'redeem'      // channel point redemption with text input

export interface BadgeInfo {
  id: string
  version: string
  title: string
  imageUrl: string
}

export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'emote'; emote: EmoteData }
  | { type: 'mention'; content: string }
  | { type: 'link'; url: string; display: string }

export interface ReplyContext {
  msgId: string
  userLogin: string
  userDisplayName: string
  msgBody: string
}

export interface NormalizedMessage {
  id: string
  platform: Platform
  channelId: string
  channelDisplayName: string
  authorId: string
  authorName: string
  authorDisplayName: string
  authorColor: string | null
  parts: MessagePart[]
  badges: BadgeInfo[]
  messageType: MessageType
  isHighlighted: boolean
  isMention: boolean
  isAction: boolean
  isDeleted: boolean
  timestamp: number
  raw: string
  replyTo?: ReplyContext
  customRewardId?: string
  pluginAction?: PluginAction
}

export interface DeleteMessageEvent {
  channelId: string
  messageId?: string
  authorId?: string
}
