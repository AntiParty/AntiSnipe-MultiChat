// @name Now Playing (!song)
// When you type !song in chat, the app looks up what's currently playing
// on your computer (via Spotify on Windows) and sends it to chat.
//
// Requirements:
//   - Windows only (uses PowerShell to read the Spotify window title).
//   - Spotify must be open and playing.
//
// Usage: type  !song  in any connected chat and press Enter.

export default function songCommand(msg) {
  if (msg.text.trim().toLowerCase() === '!song') {
    // '__song__' is a special token the app replaces with the current track.
    // Result format: "Artist - Song Title"  (from Spotify's window title)
    return { type: 'command', respond: '__song__' }
  }
  return null
}
