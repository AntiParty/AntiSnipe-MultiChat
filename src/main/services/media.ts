import { execFile } from 'child_process'

// Reads the Spotify window title (Windows only) — no API key required.
// Spotify runs several processes; only the real window has a title. While
// playing, the title is "Artist - Song"; paused/idle it's just "Spotify" /
// "Spotify Premium", so require the " - " separator to avoid reporting those.
const SPOTIFY_TITLE_SCRIPT =
  "$ErrorActionPreference = 'SilentlyContinue'; " +
  '$t = (Get-Process -Name Spotify -ErrorAction SilentlyContinue | ' +
  'Where-Object { $_.MainWindowTitle } | Select-Object -First 1).MainWindowTitle; ' +
  "if ($t -and $t -match ' - ' -and $t -notmatch '^Spotify') { $t }"

/**
 * Returns the currently playing Spotify track, or '' if nothing is playing.
 * Async on purpose: the old execSync version froze the entire main process
 * (all IPC and chat) for up to 3 seconds per lookup.
 */
export function getCurrentSong(): Promise<string> {
  if (process.platform !== 'win32') return Promise.resolve('')
  return new Promise(resolve => {
    execFile(
      'powershell',
      ['-NoProfile', '-Command', SPOTIFY_TITLE_SCRIPT],
      { timeout: 3000, windowsHide: true },
      (err, stdout) => {
        resolve(err ? '' : stdout.trim())
      }
    )
  })
}
