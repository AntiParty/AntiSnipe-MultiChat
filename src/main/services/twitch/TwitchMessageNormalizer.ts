import { parseEmoteTag, nickFromPrefix } from './TwitchIrcParser'
import { twitchBadgeResolver } from './TwitchBadgeResolver'
import { emoteResolver } from '../../emotes/EmoteResolver'
import { TWITCH_EMOTE_BASE } from '../../../shared/constants'
import type { ParsedIrcMessage } from './TwitchIrcParser'
import type { NormalizedMessage, MessagePart, MessageType, ReplyContext } from '../../../shared/types/message'

const URL_REGEX = /https?:\/\/[^\s<>[\]{}|\\^`"]+/g

function buildUrlFromId(id: string): { x1: string; x2: string; x4: string } {
  return {
    x1: `${TWITCH_EMOTE_BASE}/${id}/default/dark/1.0`,
    x2: `${TWITCH_EMOTE_BASE}/${id}/default/dark/2.0`,
    x4: `${TWITCH_EMOTE_BASE}/${id}/default/dark/3.0`
  }
}

function tokenizeText(text: string, channelId: string, mentionKeywords: string[]): MessagePart[] {
  const parts: MessagePart[] = []
  const words = text.split(/(\s+)/)

  for (const word of words) {
    if (!word) continue

    // Check for URL
    if (/^https?:\/\//.test(word)) {
      parts.push({ type: 'link', url: word, display: word })
      continue
    }

    // Check for third-party emote by word
    const emoteData = emoteResolver.resolve(word.trim(), channelId)
    if (emoteData && word.trim() === word) {
      parts.push({ type: 'emote', emote: emoteData })
      continue
    }

    // Check for mention keyword
    const lword = word.toLowerCase()
    if (mentionKeywords.some(kw => lword.includes(kw.toLowerCase()))) {
      parts.push({ type: 'mention', content: word })
      continue
    }

    parts.push({ type: 'text', content: word })
  }

  return parts
}

export function buildSelfMessage(
  channelId: string,
  channelDisplayName: string,
  text: string,
  authorName: string,
  authorId: string,
  mentionKeywords: string[],
  keywordAlerts: string[],
  badgeTag = '',
  broadcasterId?: string
): NormalizedMessage {
  const parts = tokenizeText(text, channelId, mentionKeywords)
  const rawLower = text.toLowerCase()
  const badges = twitchBadgeResolver.resolve(badgeTag, broadcasterId)
  return {
    id: `self-${Date.now()}-${Math.random()}`,
    platform: 'twitch',
    channelId,
    channelDisplayName,
    authorId,
    authorName,
    authorDisplayName: authorName,
    authorColor: null,
    parts,
    badges,
    messageType: 'chat',
    isHighlighted: keywordAlerts.some(kw => rawLower.includes(kw.toLowerCase())),
    isMention: false,
    isAction: false,
    isDeleted: false,
    timestamp: Date.now(),
    raw: text,
  }
}

export function normalizeTwitchMessage(
  msg: ParsedIrcMessage,
  channelId: string,
  channelDisplayName: string,
  broadcasterId: string | undefined,
  mentionKeywords: string[],
  keywordAlerts: string[],
  isAction = false
): NormalizedMessage | null {
  if (!msg.prefix || !msg.params[1]) return null

  const raw = msg.params[1]
  const tags = msg.tags

  // Extract reply-parent context
  let replyTo: ReplyContext | undefined
  const replyParentLogin = tags['reply-parent-user-login']
  if (replyParentLogin) {
    replyTo = {
      msgId: tags['reply-parent-msg-id'] || '',
      userLogin: replyParentLogin,
      userDisplayName: tags['reply-parent-display-name'] || replyParentLogin,
      msgBody: tags['reply-parent-msg-body'] || ''
    }
  }

  // When it's a reply, Twitch prepends "@login " — strip it for rendering
  const strippedRaw = replyTo
    ? raw.replace(new RegExp(`^@${replyTo.userLogin}\\s+`, 'i'), '').trim()
    : raw

  const bodyText = isAction
    ? strippedRaw.replace(/^\x01ACTION /, '').replace(/\x01$/, '')
    : strippedRaw
  const authorName = nickFromPrefix(msg.prefix)
  const authorDisplayName = tags['display-name'] || authorName
  const authorId = tags['user-id'] || ''
  const authorColor = tags['color'] || null
  const msgId = tags['id'] || `${Date.now()}-${Math.random()}`
  const timestamp = tags['tmi-sent-ts'] ? parseInt(tags['tmi-sent-ts'], 10) : Date.now()

  // Parse Twitch native emotes (position-based)
  const emotePositions = parseEmoteTag(tags['emotes'] || '')

  // Sort positions by start index so we can walk through the message
  const allPositions: Array<{ start: number; end: number; id: string }> = []
  for (const ep of emotePositions) {
    for (const pos of ep.positions) {
      allPositions.push({ ...pos, id: ep.id })
    }
  }
  allPositions.sort((a, b) => a.start - b.start)

  const parts: MessagePart[] = []
  let cursor = 0

  for (const { start, end, id } of allPositions) {
    // Text before this emote
    if (start > cursor) {
      const textBefore = bodyText.slice(cursor, start)
      parts.push(...tokenizeText(textBefore, channelId, mentionKeywords))
    }

    // Twitch native emote
    const emoteName = bodyText.slice(start, end + 1)
    parts.push({
      type: 'emote',
      emote: {
        id,
        name: emoteName,
        provider: 'twitch',
        urls: buildUrlFromId(id),
        animated: false,
        zeroWidth: false
      }
    })

    cursor = end + 1
  }

  // Remaining text after last emote
  if (cursor < bodyText.length) {
    parts.push(...tokenizeText(bodyText.slice(cursor), channelId, mentionKeywords))
  }

  const badges = twitchBadgeResolver.resolve(tags['badges'] || '', broadcasterId)

  // Check keyword alerts
  const rawLower = raw.toLowerCase()
  const isHighlighted = keywordAlerts.some(kw => rawLower.includes(kw.toLowerCase()))
  const isMention = mentionKeywords.some(kw => rawLower.includes(kw.toLowerCase()))

  return {
    id: msgId,
    platform: 'twitch',
    channelId,
    channelDisplayName,
    authorId,
    authorName,
    authorDisplayName,
    authorColor,
    parts,
    badges,
    messageType: isAction ? 'action' : 'chat',
    isHighlighted,
    isMention,
    isAction,
    isDeleted: false,
    timestamp,
    raw,
    replyTo
  }
}

export function normalizeUserNotice(
  msg: ParsedIrcMessage,
  channelId: string,
  channelDisplayName: string
): NormalizedMessage | null {
  const tags = msg.tags
  const msgId = tags['id'] || `${Date.now()}-${Math.random()}`
  const subType = tags['msg-id']
  const systemMsg = tags['system-msg']?.replace(/\\s/g, ' ') || ''

  let messageType: MessageType = 'system'
  if (subType === 'sub' || subType === 'resub') messageType = subType as MessageType
  else if (subType === 'subgift' || subType === 'submysterygift') messageType = 'giftsub'
  else if (subType === 'raid') messageType = 'raid'
  else if (subType === 'announcement') messageType = 'announcement'

  return {
    id: msgId,
    platform: 'twitch',
    channelId,
    channelDisplayName,
    authorId: tags['user-id'] || '',
    authorName: tags['login'] || '',
    authorDisplayName: tags['display-name'] || tags['login'] || 'System',
    authorColor: tags['color'] || null,
    parts: [{ type: 'text', content: systemMsg }],
    badges: [],
    messageType,
    isHighlighted: false,
    isMention: false,
    isAction: false,
    isDeleted: false,
    timestamp: Date.now(),
    raw: systemMsg
  }
}
