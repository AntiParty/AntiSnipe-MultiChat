/**
 * Generates a deterministic HSL color from a username string.
 * Uses FNV-1a 32-bit hash → hue, with fixed saturation/lightness
 * for readability on dark backgrounds.
 */
export function colorHash(username: string | null | undefined): string {
  if (!username) return 'hsl(0, 0%, 70%)'
  let hash = 2166136261 >>> 0
  for (let i = 0; i < username.length; i++) {
    hash ^= username.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 65%)`
}

/**
 * Ensures a hex color is readable on a dark background by boosting
 * lightness to a minimum of 55%. Passes through non-hex values unchanged.
 * Twitch ships colors like #8B0000 (dark red) or #000080 (navy) that are
 * near-invisible on dark themes without this adjustment.
 */
export function readableColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex

  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  const finalL = Math.max(l, 0.55)
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(finalL * 100)}%)`
}
