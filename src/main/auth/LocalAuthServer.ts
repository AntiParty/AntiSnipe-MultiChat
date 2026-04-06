import * as http from 'http'
import log from 'electron-log'

// Fixed port — users register this exact URI in their OAuth app settings.
// Random ports can't be pre-registered; a fixed port solves redirect_mismatch errors.
export const AUTH_CALLBACK_PORT = 47891

export const TWITCH_REDIRECT_URI = `http://localhost:${AUTH_CALLBACK_PORT}/auth/twitch`
export const YOUTUBE_REDIRECT_URI = `http://localhost:${AUTH_CALLBACK_PORT}/auth/youtube`

const SUCCESS_HTML =
  '<!DOCTYPE html><html><head><title>Confluence Auth</title></head>' +
  '<body style="font-family:sans-serif;text-align:center;padding:60px;background:#111;color:#d9d9d9">' +
  '<h2>Authentication successful!</h2><p>You can close this tab.</p>' +
  '</body></html>'

export function startLocalAuthServer(platform: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith(`/auth/${platform}`)) {
        res.writeHead(404)
        res.end()
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(SUCCESS_HTML)
      server.close()
      resolve(`http://localhost:${AUTH_CALLBACK_PORT}${req.url}`)
    })

    server.listen(AUTH_CALLBACK_PORT, '127.0.0.1', () => {
      log.info(`OAuth callback server listening on port ${AUTH_CALLBACK_PORT} for ${platform}`)
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${AUTH_CALLBACK_PORT} is already in use. Close whatever is using it and try again.`
        ))
      } else {
        reject(err)
      }
    })

    setTimeout(() => {
      server.close()
      reject(new Error('OAuth authentication timed out after 5 minutes'))
    }, 5 * 60 * 1000)
  })
}
