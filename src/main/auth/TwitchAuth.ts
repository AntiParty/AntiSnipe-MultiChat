import { shell, net } from 'electron'
import crypto from 'crypto'
import log from 'electron-log'
import { settingsStore } from '../store/SettingsStore'
import { tokenStore } from './TokenStore'
import { broadcaster } from '../ipc/broadcaster'
import { startLocalAuthServer, TWITCH_REDIRECT_URI } from './LocalAuthServer'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import { TWITCH_AUTH_BASE, TWITCH_HELIX_BASE } from '../../shared/constants'

interface PendingAuth {
  state: string
}

class TwitchAuth {
  private pending: PendingAuth | null = null

  async startFlow(): Promise<void> {
    const settings = settingsStore.get()
    const clientId = settings.twitchClientId
    const clientSecret = settings.twitchClientSecret

    if (!clientId || !clientSecret) {
      broadcaster.send(RENDERER_CHANNELS.PLATFORM_ERROR, {
        channelId: '',
        code: 'NO_CREDENTIALS',
        message: 'Enter both Client ID and Client Secret in Settings → Auth before connecting.'
      })
      return
    }

    const state = crypto.randomBytes(16).toString('hex')
    this.pending = { state }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: TWITCH_REDIRECT_URI,
      response_type: 'code',
      scope: 'chat:read chat:edit user:read:email moderator:manage:banned_users moderator:manage:chat_messages moderator:read:followers channel:read:subscriptions',
      state
    })

    log.info('Opening Twitch OAuth URL')
    await shell.openExternal(`${TWITCH_AUTH_BASE}/authorize?${params}`)

    startLocalAuthServer('twitch')
      .then(url => this.handleCallback(url))
      .catch(err => {
        log.error('Twitch OAuth server error:', err)
        this.pending = null
        broadcaster.send(RENDERER_CHANNELS.AUTH_STATE_CHANGED, {
          platform: 'twitch',
          state: { status: 'error', error: String(err) }
        })
      })
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

      this.pending = null
      await this.exchangeCode(code)
    } catch (err) {
      log.error('Twitch auth callback error:', err)
      this.pending = null
      broadcaster.send(RENDERER_CHANNELS.AUTH_STATE_CHANGED, {
        platform: 'twitch',
        state: { status: 'error', error: String(err) }
      })
    }
  }

  private async exchangeCode(code: string): Promise<void> {
    const settings = settingsStore.get()
    const { twitchClientId: clientId, twitchClientSecret: clientSecret } = settings

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: TWITCH_REDIRECT_URI
    })

    const tokenResp = await net.fetch(`${TWITCH_AUTH_BASE}/token`, {
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

    const userResp = await net.fetch(`${TWITCH_HELIX_BASE}/users`, {
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
    const { twitchClientId: clientId, twitchClientSecret: clientSecret } = settings

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })

      const resp = await net.fetch(`${TWITCH_AUTH_BASE}/token`, {
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
