export interface IrcTags {
  [key: string]: string
}

export interface EmotePosition {
  id: string
  positions: Array<{ start: number; end: number }>
}

export interface ParsedIrcMessage {
  raw: string
  tags: IrcTags
  prefix: string | null
  command: string
  params: string[]
}

/**
 * Parse a raw IRC line into its components.
 * Handles the Twitch IRCv3 tag format.
 */
export function parseIrcLine(line: string): ParsedIrcMessage | null {
  if (!line || !line.trim()) return null

  let pos = 0
  const tags: IrcTags = {}

  // Parse tags (@key=value;key2=value2)
  if (line[0] === '@') {
    const tagEnd = line.indexOf(' ', 1)
    if (tagEnd === -1) return null
    const tagString = line.slice(1, tagEnd)
    for (const part of tagString.split(';')) {
      const eqIdx = part.indexOf('=')
      if (eqIdx === -1) {
        tags[part] = ''
      } else {
        tags[part.slice(0, eqIdx)] = part.slice(eqIdx + 1)
      }
    }
    pos = tagEnd + 1
  }

  // Skip whitespace
  while (pos < line.length && line[pos] === ' ') pos++

  // Parse prefix (:nick!user@host)
  let prefix: string | null = null
  if (line[pos] === ':') {
    const prefixEnd = line.indexOf(' ', pos)
    if (prefixEnd === -1) return null
    prefix = line.slice(pos + 1, prefixEnd)
    pos = prefixEnd + 1
    while (pos < line.length && line[pos] === ' ') pos++
  }

  // Parse command
  const commandEnd = line.indexOf(' ', pos)
  let command: string
  const params: string[] = []

  if (commandEnd === -1) {
    command = line.slice(pos)
    return { raw: line, tags, prefix, command, params }
  }

  command = line.slice(pos, commandEnd)
  pos = commandEnd + 1

  // Parse params
  while (pos < line.length) {
    while (pos < line.length && line[pos] === ' ') pos++
    if (pos >= line.length) break

    if (line[pos] === ':') {
      // Trailing param - rest of line
      params.push(line.slice(pos + 1))
      break
    }

    const spaceIdx = line.indexOf(' ', pos)
    if (spaceIdx === -1) {
      params.push(line.slice(pos))
      break
    }
    params.push(line.slice(pos, spaceIdx))
    pos = spaceIdx + 1
  }

  return { raw: line, tags, prefix, command, params }
}

/**
 * Parse the Twitch "emotes" tag value into structured emote positions.
 *
 * Format: "25:0-4,7-11/1902:12-16"
 *   emoteId : startPos-endPos , startPos-endPos / nextEmoteId : ...
 *
 * NOTE: positions index into the raw message string's UTF-16 code units,
 * not Unicode codepoints. JavaScript strings are UTF-16 natively, so we
 * can index directly with bracket notation.
 */
export function parseEmoteTag(emoteTag: string): EmotePosition[] {
  if (!emoteTag) return []

  const result: EmotePosition[] = []
  for (const part of emoteTag.split('/')) {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) continue
    const id = part.slice(0, colonIdx)
    const ranges = part.slice(colonIdx + 1)
    const positions: Array<{ start: number; end: number }> = []
    for (const range of ranges.split(',')) {
      const dashIdx = range.indexOf('-')
      if (dashIdx === -1) continue
      const start = parseInt(range.slice(0, dashIdx), 10)
      const end = parseInt(range.slice(dashIdx + 1), 10)
      if (!isNaN(start) && !isNaN(end)) {
        positions.push({ start, end })
      }
    }
    if (positions.length > 0) {
      result.push({ id, positions })
    }
  }
  return result
}

/**
 * Extract nick from prefix string "nick!user@host"
 */
export function nickFromPrefix(prefix: string): string {
  const bang = prefix.indexOf('!')
  return bang === -1 ? prefix : prefix.slice(0, bang)
}
