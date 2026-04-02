// @name Bot Filter
// Hides messages from known bot accounts.
// Add bot usernames (lowercase) to the BOTS set below.
// Common bots: Nightbot, StreamElements, Moobot, etc.

const BOTS = new Set([
  'nightbot',
  'streamelements',
  'streamlabs',
  'moobot',
  'fossabot',
  'wizebot',
  'botisimo',
  'soundalerts',
])

export default function botFilter(msg) {
  if (BOTS.has(msg.author.toLowerCase())) {
    return { type: 'hide' }
  }
  return null
}
