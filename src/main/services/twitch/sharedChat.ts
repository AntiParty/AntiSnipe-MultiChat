import type { IrcTags } from './TwitchIrcParser'

/**
 * Twitch Shared Chat (collaborative streams): every message in a shared
 * session is delivered once per joined channel, tagged with the origin room:
 *
 *   source-room-id  — broadcaster ID of the channel the message was sent in
 *   source-id       — message UUID shared by all copies of the message
 *   source-badges   — the author's badges in the origin channel
 *
 * A message is "foreign" in a given room when it originated in a different
 * room of the shared session.
 */
export interface SharedChatInfo {
  sourceRoomId: string
  isForeign: boolean
}

export function getSharedChatInfo(tags: IrcTags, currentRoomId?: string): SharedChatInfo | null {
  const sourceRoomId = tags['source-room-id']
  if (!sourceRoomId) return null
  const roomId = currentRoomId || tags['room-id']
  return { sourceRoomId, isForeign: !!roomId && sourceRoomId !== roomId }
}

/**
 * Chatterino-style dedup: a foreign copy is dropped when its home channel is
 * also open in the app — the user already sees it there. Foreign messages
 * from channels the user has NOT joined stay visible (with attribution).
 */
export function shouldDropSharedMessage(
  info: SharedChatInfo | null,
  isSourceChannelJoined: boolean
): boolean {
  return !!info && info.isForeign && isSourceChannelJoined
}
