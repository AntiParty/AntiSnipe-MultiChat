// @name Subscriber Highlight
// Adds a subtle teal highlight to messages from subscribers and founders.
// Useful for visually separating paying members from general chat.

export default function subHighlight(msg) {
  if (msg.isSubscriber) {
    return { type: 'highlight', color: 'rgba(56, 189, 170, 0.08)' }
  }
  return null
}
