// Compiled RegExp cache keyed by serialized keyword list
let cachedKeywords: string[] = []
let cachedRegex: RegExp | null = null

export function compileKeywords(keywords: string[]): RegExp | null {
  if (keywords.length === 0) return null
  // Only recompile if keywords changed
  if (
    cachedRegex &&
    keywords.length === cachedKeywords.length &&
    keywords.every((k, i) => k === cachedKeywords[i])
  ) {
    return cachedRegex
  }
  cachedKeywords = [...keywords]
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  cachedRegex = new RegExp(escaped.join('|'), 'i')
  return cachedRegex
}

export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false
  const regex = compileKeywords(keywords)
  return regex ? regex.test(text) : false
}
