import { settingsStore } from '../../store/SettingsStore'
import type { NormalizedMessage, MessagePart, BadgeInfo } from '../../../shared/types/message'

// User shape nested inside all tiktok-live-connector v2 events
export interface TikTokUser {
  userId: string
  uniqueId: string
  nickname: string
  profilePictureUrl?: string
  isModerator?: boolean
  isSubscriber?: boolean
}

export interface TikTokChatData {
  user: TikTokUser
  comment: string
}

export interface TikTokGiftData {
  user: TikTokUser
  giftId: number
  // v2: gift metadata is nested under giftDetails
  giftDetails?: {
    giftName: string
    diamondCount: number
  }
  repeatCount: number
  repeatEnd: number  // 1 = streak ended, 0 = ongoing
}

export interface TikTokSubscribeData {
  user: TikTokUser
  subMonth?: number
}

function parseParts(text: string): MessagePart[] {
  if (!text) return []
  const urlRe = /https?:\/\/[^\s]+/g
  const parts: MessagePart[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: text.slice(last, m.index) })
    parts.push({ type: 'link', url: m[0], display: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) })
  return parts.length ? parts : [{ type: 'text', content: text }]
}

function checkMention(text: string, keywords: string[]): boolean {
  if (!keywords.length) return false
  const lower = text.toLowerCase()
  return keywords.some(k => lower.includes(k.toLowerCase()))
}

function checkHighlight(text: string, keywords: string[]): boolean {
  if (!keywords.length) return false
  const lower = text.toLowerCase()
  return keywords.some(k => lower.includes(k.toLowerCase()))
}

function buildBadges(user: TikTokUser): BadgeInfo[] {
  const badges: BadgeInfo[] = []
  if (user.isModerator) {
    badges.push({ id: 'moderator', version: '1', title: 'Moderator', imageUrl: '' })
  }
  if (user.isSubscriber) {
    badges.push({ id: 'subscriber', version: '1', title: 'Subscriber', imageUrl: '' })
  }
  return badges
}

export function normalizeTikTokChat(
  data: TikTokChatData,
  channelId: string,
  channelDisplayName: string
): NormalizedMessage | null {
  if (!data.comment?.trim()) return null

  const settings = settingsStore.get()
  const text = data.comment
  const { user } = data
  const isMention = checkMention(text, settings.mentionKeywords)
  const isHighlighted = checkHighlight(text, settings.keywordAlerts)

  return {
    id: `tiktok-chat-${user.userId}-${Date.now()}-${Math.random()}`,
    platform: 'tiktok',
    channelId,
    channelDisplayName,
    authorId: user.userId,
    authorName: user.uniqueId,
    authorDisplayName: user.nickname || user.uniqueId,
    authorColor: null,
    parts: parseParts(text),
    badges: buildBadges(user),
    messageType: 'chat',
    isHighlighted,
    isMention,
    isAction: false,
    isDeleted: false,
    timestamp: Date.now(),
    raw: text
  }
}

export function normalizeTikTokGift(
  data: TikTokGiftData,
  channelId: string,
  channelDisplayName: string
): NormalizedMessage | null {
  // Only emit when streak ends (repeatEnd=1) or single gift
  if (!data.repeatEnd && data.repeatCount > 1) return null

  const { user } = data
  const count = data.repeatCount || 1
  const name = data.giftDetails?.giftName ?? 'gift'
  const diamonds = data.giftDetails?.diamondCount ?? 0
  const text = count > 1
    ? `gifted ${count}x ${name} (${diamonds * count} 💎)`
    : `gifted ${name} (${diamonds} 💎)`

  return {
    id: `tiktok-gift-${user.userId}-${Date.now()}-${Math.random()}`,
    platform: 'tiktok',
    channelId,
    channelDisplayName,
    authorId: user.userId,
    authorName: user.uniqueId,
    authorDisplayName: user.nickname || user.uniqueId,
    authorColor: null,
    parts: [{ type: 'text', content: text }],
    badges: [],
    messageType: 'giftsub',
    isHighlighted: false,
    isMention: false,
    isAction: false,
    isDeleted: false,
    timestamp: Date.now(),
    raw: text
  }
}

export function normalizeTikTokSubscribe(
  data: TikTokSubscribeData,
  channelId: string,
  channelDisplayName: string
): NormalizedMessage {
  const { user } = data
  const text = data.subMonth && data.subMonth > 1
    ? `resubscribed for ${data.subMonth} months`
    : 'subscribed'

  return {
    id: `tiktok-sub-${user.userId}-${Date.now()}`,
    platform: 'tiktok',
    channelId,
    channelDisplayName,
    authorId: user.userId,
    authorName: user.uniqueId,
    authorDisplayName: user.nickname || user.uniqueId,
    authorColor: null,
    parts: [{ type: 'text', content: text }],
    badges: [],
    messageType: data.subMonth && data.subMonth > 1 ? 'resub' : 'sub',
    isHighlighted: false,
    isMention: false,
    isAction: false,
    isDeleted: false,
    timestamp: Date.now(),
    raw: text
  }
}
