import { shell } from 'electron'
import crypto from 'crypto'
import log from 'electron-log'
import { settingsStore } from '../store/SettingsStore'
import { tokenStore } from './TokenStore'
import { broadcaster } from '../ipc/broadcaster'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import {
  YOUTUBE_AUTH_BASE,
  YOUTUBE_TOKEN_URL,
  YOUTUBE_SCOPES,
  CUSTOM_PROTOCOL
} from '../../shared/constants'

interface PendingAuth {
  codeVerifier: string
  state: string
}

class YouTubeAuth {
  private pending: PendingAuth | null = null

  private generateCodeVerifier(): string {
    return crypto.randomBytes(64).toString('base64url')
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest().toString('base64url')
  }

  async startFlow(): Promise<void> {
    const settings = settingsStore.get()
    const clientId = settings.googleClientId
    if (!clientId) {
      broadcaster.send(RENDERER_CHANNELS.PLATFORM_ERROR, {
        channelId: '',
        code: 'NO_CLIENT_ID',
        message: 'No Google Client ID configured. Add it in Settings → Auth.'
      })
      return
    }

    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = this.generateCodeChallenge(codeVerifier)
    const state = crypto.randomBytes(16).toString('hex')

    this.pending = { codeVerifier, state }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${CUSTOM_PROTOCOL}://auth/youtube`,
      response_type: 'code',
      scope: YOUTUBE_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      prompt: 'consent'
    })

    const url = `${YOUTUBE_AUTH_BASE}?${params}`
    log.info('Opening YouTube OAuth URL')
    await shell.openExternal(url)
  }

  async handleCallback(url: string): Promise<void> {
    if (!this.pending) {
      log.warn('Received YouTube auth callback with no pending flow')
      return
    }

    try {
      const parsed = new URL(url)
      const code = parsed.searchParams.get('code')
      const state = parsed.searchParams.get('state')
      const error = parsed.searchParams.get('error')

      if (error) throw new Error(`OAuth error: ${error}`)
      if (state !== this.pending.state) throw new Error('OAuth state mismatch')
      if (!code) throw new Error('No authorization code received')

      const { codeVerifier } = this.pending
      this.pending = null

      await this.exchangeCode(code, codeVerifier)
    } catch (err) {
      log.error('YouTube auth callback error:', err)
      this.pending = null
      broadcaster.send(RENDERER_CHANNELS.AUTH_STATE_CHANGED, {
        platform: 'youtube',
        state: { status: 'error', error: String(err) }
      })
    }
  }

  private async exchangeCode(code: string, codeVerifier: string): Promise<void> {
    const settings = settingsStore.get()
    const clientId = settings.googleClientId

    const body = new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: `${CUSTOM_PROTOCOL}://auth/youtube`
    })

    const resp = await fetch(YOUTUBE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`Token exchange failed: ${resp.status} ${text}`)
    }

    const data = (await resp.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    // Get user channel info
    let username: string | undefined
    try {
      const channelResp = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${data.access_token}` } }
      )
      if (channelResp.ok) {
        const channelData = (await channelResp.json()) as {
          items?: { snippet: { title: string } }[]
        }
        username = channelData.items?.[0]?.snippet?.title
      }
    } catch {
      // non-critical
    }

    tokenStore.saveTokens('youtube', data.access_token, {
      refreshToken: data.refresh_token,
      username,
      expiresIn: data.expires_in
    })

    broadcaster.send(RENDERER_CHANNELS.AUTH_STATE_CHANGED, {
      platform: 'youtube',
      state: { status: 'authenticated', username }
    })

    log.info('YouTube auth successful for user:', username)
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = tokenStore.getRefreshToken('youtube')
    if (!refreshToken) return null

    const settings = settingsStore.get()
    const clientId = settings.googleClientId

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })

      const resp = await fetch(YOUTUBE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })

      if (!resp.ok) return null

      const data = (await resp.json()) as { access_token: string; expires_in?: number }
      const { username, userId } = tokenStore.getUserInfo('youtube')
      tokenStore.saveTokens('youtube', data.access_token, {
        refreshToken,
        username,
        userId,
        expiresIn: data.expires_in
      })

      return data.access_token
    } catch (err) {
      log.error('YouTube token refresh failed:', err)
      return null
    }
  }
}

export const youtubeAuth = new YouTubeAuth()
