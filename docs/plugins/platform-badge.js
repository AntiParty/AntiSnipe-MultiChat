// @name Platform Badge
// Adds a colored tag showing which platform a message came from.
// Most useful in the "All Channels" view where messages from different
// platforms are mixed together.

const LABELS = {
  twitch:  { label: 'Twitch',  color: '#9147ff' },
  youtube: { label: 'YouTube', color: '#cc0000' },
  kick:    { label: 'Kick',    color: '#53fc18' },
  tiktok:  { label: 'TikTok',  color: '#ff0050' },
}

export default function platformBadge(msg) {
  const entry = LABELS[msg.platform]
  if (!entry) return null
  return { type: 'tag', label: entry.label, color: entry.color }
}
