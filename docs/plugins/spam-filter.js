// @name Spam Filter
// Hides messages that look like spam:
//   - 70%+ of the message is uppercase
//   - A single character repeated 6+ times in a row (aaaaaaaa, !!!!!!)
//   - Message is over 400 characters long

export default function spamFilter(msg) {
  const text = msg.text.trim()
  if (!text) return null

  // All-caps check (ignore short messages — "LOL" is fine)
  if (text.length > 10) {
    const letters = text.replace(/[^a-zA-Z]/g, '')
    if (letters.length > 5) {
      const upperRatio = (letters.replace(/[^A-Z]/g, '').length) / letters.length
      if (upperRatio >= 0.7) return { type: 'hide' }
    }
  }

  // Repeated character check
  if (/(.)\1{5,}/.test(text)) return { type: 'hide' }

  // Excessive length
  if (text.length > 400) return { type: 'hide' }

  return null
}
