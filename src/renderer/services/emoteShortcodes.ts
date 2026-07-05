/** Replace :emotename: / :emotename tokens with the emote's real (cased) name.
 *  Only tokens that resolve to a known channel emote are touched, so ":)"
 *  and timestamps pass through untouched. */
export function expandEmoteShortcodes(text: string, emoteByLower: Record<string, string>): string {
  return text
    .split(/(\s+)/)
    .map(token => {
      const m = token.match(/^:([\w-]+):?$/)
      if (!m) return token
      return emoteByLower[m[1].toLowerCase()] ?? token
    })
    .join('')
}
