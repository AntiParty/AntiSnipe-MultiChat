// @name Keyword Highlight
// Highlights messages that contain any of the configured keywords.
// Add your own keywords to the array below (case-insensitive).
//
// Colors:
//   Gold alert:   rgba(255, 200, 0, 0.15)
//   Blue info:    rgba(100, 160, 255, 0.15)
//   Red urgent:   rgba(255, 80, 80, 0.15)
//   Green calm:   rgba(80, 200, 120, 0.12)

const KEYWORDS = [
  'giveaway',
  'clip that',
  'poggers',
  '!commands',
]

const HIGHLIGHT_COLOR = 'rgba(255, 200, 0, 0.15)'

export default function keywordHighlight(msg) {
  const lower = msg.text.toLowerCase()
  for (const kw of KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return { type: 'highlight', color: HIGHLIGHT_COLOR }
    }
  }
  return null
}
