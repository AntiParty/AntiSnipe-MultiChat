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

/** Thrown into an in-flight flow when a newer flow replaces it — callers should ignore it. */
export class AuthFlowSupersededError extends Error {
  constructor() {
    super('OAuth flow superseded by a newer login attempt')
    this.name = 'AuthFlowSupersededError'
  }
}

// Only one callback server can own the fixed port. Starting a new flow cancels
// the previous one instead of failing with EADDRINUSE for up to 5 minutes.
let activeFlow: { cancel: () => void } | null = null

export function startLocalAuthServer(platform: string): Promise<string> {
  activeFlow?.cancel()
  activeFlow = null

  return new Promise((resolve, reject) => {
    let settled = false

    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith(`/auth/${platform}`)) {
        res.writeHead(404)
        res.end()
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(SUCCESS_HTML)
      finish(() => resolve(`http://localhost:${AUTH_CALLBACK_PORT}${req.url}`))
    })

    const finish = (settle: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      server.close()
      if (activeFlow === flow) activeFlow = null
      settle()
    }

    const flow = { cancel: () => finish(() => reject(new AuthFlowSupersededError())) }
    activeFlow = flow

    const timeout = setTimeout(() => {
      finish(() => reject(new Error('OAuth authentication timed out after 5 minutes')))
    }, 5 * 60 * 1000)

    server.listen(AUTH_CALLBACK_PORT, '127.0.0.1', () => {
      log.info(`OAuth callback server listening on port ${AUTH_CALLBACK_PORT} for ${platform}`)
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        finish(() => reject(new Error(
          `Port ${AUTH_CALLBACK_PORT} is already in use by another program. Close it and try again.`
        )))
      } else {
        finish(() => reject(err))
      }
    })
  })
}
