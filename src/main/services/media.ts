import { execFile } from 'child_process'

// Reads the Spotify window title (Windows only) — no API key required.
const SPOTIFY_TITLE_SCRIPT =
  "$ErrorActionPreference = 'SilentlyContinue'; " +
  '$spotify = (Get-Process -Name Spotify -ErrorAction SilentlyContinue).MainWindowTitle; ' +
  "if ($spotify) { $song = $spotify -replace '^Spotify ?- ?'; if ($song -ne '') { $song } }"

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
