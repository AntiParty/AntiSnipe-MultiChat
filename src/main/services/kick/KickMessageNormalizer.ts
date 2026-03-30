import { emoteResolver } from '../../emotes/EmoteResolver'
import { KICK_FILES_BASE } from '../../../shared/constants'
import type { NormalizedMessage, MessagePart } from '../../../shared/types/message'

// Native Kick emote token format: [emote:12345:emoteName]
const KICK_EMOTE_REGEX = /\[emote:(\d+):([^\]]+)\]/g
const URL_REGEX = /https?:\/\/[^\s]+/

export interface RawKickMessage {
  id: string
  content: string
  created_at: string
  sender: {
    id: number
    username: string
    identity?: {
      color?: string
      badges?: Array<{ type: string; text: string; count?: number }>
    }
  }
}

function tokenizeLine(text: string, channelId: string, mentionKeywords: string[]): MessagePart[] {
  const parts: MessagePart[] = []
  const words = text.split(/(\s+)/)

  for (const word of words) {
    if (!word) continue

    if (URL_REGEX.test(word)) {
      parts.push({ type: 'link', url: word, display: word })
      continue
    }

    const trimmed = word.trim()
    if (trimmed) {
      const emote = emoteResolver.resolve(trimmed, channelId)
      if (emote) {
        parts.push({ type: 'emote', emote })
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

export function normalizeKickMessage(
  raw: RawKickMessage,
  channelId: string,
  channelDisplayName: string,
  mentionKeywords: string[],
  keywordAlerts: string[]
): NormalizedMessage | null {
  const content = raw.content || ''
  const parts: MessagePart[] = []

  // Process native Kick emote tokens and text segments
  let lastIndex = 0
  let match: RegExpExecArray | null

  KICK_EMOTE_REGEX.lastIndex = 0
  while ((match = KICK_EMOTE_REGEX.exec(content)) !== null) {
    // Text before this emote
    if (match.index > lastIndex) {
      const textPart = content.slice(lastIndex, match.index)
      parts.push(...tokenizeLine(textPart, channelId, mentionKeywords))
    }

    const [, emoteId, emoteName] = match
    parts.push({
      type: 'emote',
      emote: {
        id: emoteId,
        name: emoteName,
        provider: 'kick',
        urls: {
          x1: `${KICK_FILES_BASE}/emotes/${emoteId}/fullsize`,
          x2: `${KICK_FILES_BASE}/emotes/${emoteId}/fullsize`,
          x4: `${KICK_FILES_BASE}/emotes/${emoteId}/fullsize`
        },
        animated: false,
        zeroWidth: false
      }
    })

    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push(...tokenizeLine(content.slice(lastIndex), channelId, mentionKeywords))
  }

  const rawLower = content.toLowerCase()
  const isHighlighted = keywordAlerts.some(kw => rawLower.includes(kw.toLowerCase()))
  const isMention = mentionKeywords.some(kw => rawLower.includes(kw.toLowerCase()))

  const color = raw.sender.identity?.color
  const badges = (raw.sender.identity?.badges ?? []).map(b => ({
    id: b.type,
    version: '1',
    title: b.text,
    imageUrl: ''
  }))

  return {
    id: raw.id,
    platform: 'kick',
    channelId,
    channelDisplayName,
    authorId: String(raw.sender.id),
    authorName: raw.sender.username,
    authorDisplayName: raw.sender.username,
    authorColor: color || null,
    parts,
    badges,
    messageType: 'chat',
    isHighlighted,
    isMention,
    isAction: false,
    isDeleted: false,
    timestamp: new Date(raw.created_at).getTime(),
    raw: content
  }
}
