/**
 * Generates a deterministic HSL color from a username string.
 * Uses FNV-1a 32-bit hash → hue, with fixed saturation/lightness
 * for readability on dark backgrounds.
 */
export function colorHash(username: string): string {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < username.length; i++) {
    hash ^= username.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 65%)`
}
