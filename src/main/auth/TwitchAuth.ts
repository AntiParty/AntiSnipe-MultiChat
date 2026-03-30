import { shell } from 'electron'
import crypto from 'crypto'
import log from 'electron-log'
import { settingsStore } from '../store/SettingsStore'
import { tokenStore } from './TokenStore'
import { broadcaster } from '../ipc/broadcaster'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import { TWITCH_AUTH_BASE, TWITCH_HELIX_BASE, CUSTOM_PROTOCOL } from '../../shared/constants'

interface PendingAuth {
  codeVerifier: string
  state: string
}

class TwitchAuth {
  private pending: PendingAuth | null = null

  private generateCodeVerifier(): string {
    return crypto.randomBytes(64).toString('base64url')
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(verifier).digest()
    return hash.toString('base64url')
  }

  async startFlow(): Promise<void> {
    const settings = settingsStore.get()
    const clientId = settings.twitchClientId
    if (!clientId) {
      broadcaster.send(RENDERER_CHANNELS.PLATFORM_ERROR, {
        channelId: '',
        code: 'NO_CLIENT_ID',
        message: 'No Twitch Client ID configured. Add it in Settings → Auth.'
      })
      return
    }

    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)
    const state = crypto.randomBytes(16).toString('hex')

    this.pending = { codeVerifier, state }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${CUSTOM_PROTOCOL}://auth/twitch`,
      response_type: 'code',
      scope: 'chat:read chat:edit user:read:email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state
    })

    const url = `${TWITCH_AUTH_BASE}/authorize?${params}`
    log.info('Opening Twitch OAuth URL')
    await shell.openExternal(url)
  }

  async handleCallback(url: string): Promise<void> {
    if (!this.pending) {
      log.warn('Received Twitch auth callback with no pending flow')
      return
    }

    try {
      const parsed = new URL(url)
      const code = parsed.searchParams.get('code')
      const state = parsed.searchParams.get('state')
      const error = parsed.searchParams.get('error')

      if (error) {
        throw new Error(`OAuth error: ${error} — ${parsed.searchParams.get('error_description')}`)
      }

      if (state !== this.pending.state) {
        throw new Error('OAuth state mismatch — possible CSRF attack')
      }

      if (!code) throw new Error('No authorization code received')

      const { codeVerifier } = this.pending
      this.pending = null

      await this.exchangeCode(code, codeVerifier)
    } catch (err) {
      log.error('Twitch auth callback error:', err)
      this.pending = null
      broadcaster.send(RENDERER_CHANNELS.AUTH_STATE_CHANGED, {
        platform: 'twitch',
        state: { status: 'error', error: String(err) }
      })
    }
  }

  private async exchangeCode(code: string, codeVerifier: string): Promise<void> {
    const settings = settingsStore.get()
    const clientId = settings.twitchClientId

    const body = new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: `${CUSTOM_PROTOCOL}://auth/twitch`
    })

    const tokenResp = await fetch(`${TWITCH_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })

    if (!tokenResp.ok) {
      const text = await tokenResp.text()
      throw new Error(`Token exchange failed: ${tokenResp.status} ${text}`)
    }

    const tokenData = (await tokenResp.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    // Fetch user info
    const userResp = await fetch(`${TWITCH_HELIX_BASE}/users`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id': clientId
      }
    })

    let username: string | undefined
    let userId: string | undefined
    if (userResp.ok) {
      const userData = (await userResp.json()) as { data?: { login: string; id: string }[] }
      username = userData.data?.[0]?.login
      userId = userData.data?.[0]?.id
    }

    tokenStore.saveTokens('twitch', tokenData.access_token, {
      refreshToken: tokenData.refresh_token,
      username,
      userId,
      expiresIn: tokenData.expires_in
    })

    broadcaster.send(RENDERER_CHANNELS.AUTH_STATE_CHANGED, {
      platform: 'twitch',
      state: { status: 'authenticated', username }
    })

    log.info('Twitch auth successful for user:', username)
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = tokenStore.getRefreshToken('twitch')
    if (!refreshToken) return null

    const settings = settingsStore.get()
    const clientId = settings.twitchClientId

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })

      const resp = await fetch(`${TWITCH_AUTH_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })

      if (!resp.ok) return null

      const data = (await resp.json()) as {
        access_token: string
        refresh_token?: string
        expires_in?: number
      }

      const { username, userId } = tokenStore.getUserInfo('twitch')
      tokenStore.saveTokens('twitch', data.access_token, {
        refreshToken: data.refresh_token,
        username,
        userId,
        expiresIn: data.expires_in
      })

      return data.access_token
    } catch (err) {
      log.error('Twitch token refresh failed:', err)
      return null
    }
  }
}

export const twitchAuth = new TwitchAuth()
