import { emoteResolver } from '../../emotes/EmoteResolver'
import type { YoutubeChatMessage } from './YouTubeApiClient'
import type { NormalizedMessage, MessagePart } from '../../../shared/types/message'

const URL_REGEX = /https?:\/\/[^\s]+/g

function tokenizeLine(text: string, channelId: string, mentionKeywords: string[]): MessagePart[] {
  const parts: MessagePart[] = []
  const words = text.split(/(\s+)/)

  for (const word of words) {
    if (!word) continue

    if (/^https?:\/\//.test(word)) {
      parts.push({ type: 'link', url: word, display: word })
      continue
    }

    const trimmed = word.trim()
    if (trimmed) {
      const emoteData = emoteResolver.resolve(trimmed, channelId)
      if (emoteData) {
        parts.push({ type: 'emote', emote: emoteData })
        continue
      }
    }

    const lword = word.toLowerCase()
    if (mentionKeywords.some(kw => lword.includes(kw.toLowerCase()))) {
      parts.push({ type: 'mention', content: word })
      continue
    }

    parts.push({ type: 'text', content: word })
  }

  return parts
}

export function normalizeYouTubeMessage(
  item: YoutubeChatMessage,
  channelId: string,
  channelDisplayName: string,
  mentionKeywords: string[],
  keywordAlerts: string[],
  seenIds: Set<string>
): NormalizedMessage | null {
  if (seenIds.has(item.id)) return null
  seenIds.add(item.id)

  const { snippet, authorDetails } = item
  if (!snippet.hasDisplayContent) return null

  const raw = snippet.displayMessage || ''
  const rawLower = raw.toLowerCase()
  const isHighlighted = keywordAlerts.some(kw => rawLower.includes(kw.toLowerCase()))
  const isMention = mentionKeywords.some(kw => rawLower.includes(kw.toLowerCase()))

  const parts = tokenizeLine(raw, channelId, mentionKeywords)
  const timestamp = new Date(snippet.publishedAt).getTime()

  return {
    id: item.id,
    platform: 'youtube',
    channelId,
    channelDisplayName,
    authorId: authorDetails.channelId,
    authorName: authorDetails.displayName,
    authorDisplayName: authorDetails.displayName,
    authorColor: null,
    parts,
    badges: authorDetails.isChatOwner
      ? [{ id: 'owner', version: '1', title: 'Channel Owner', imageUrl: '' }]
      : authorDetails.isChatModerator
        ? [{ id: 'moderator', version: '1', title: 'Moderator', imageUrl: '' }]
        : authorDetails.isChatSponsor
          ? [{ id: 'member', version: '1', title: 'Member', imageUrl: '' }]
          : [],
    messageType: 'chat',
    isHighlighted,
    isMention,
    isAction: false,
    isDeleted: false,
    timestamp,
    raw
  }
}
