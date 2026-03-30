import { safeStorage, app } from 'electron'
import Store from 'electron-store'
import log from 'electron-log'
import type { AuthState } from '../../shared/types/ipc'

interface TokenEntry {
  encryptedAccessToken: string
  encryptedRefreshToken?: string
  username?: string
  userId?: string
  expiresAt?: number
}

interface TokenStoreSchema {
  twitch?: TokenEntry
  youtube?: TokenEntry
}

class TokenStore {
  private store: Store<TokenStoreSchema>

  constructor() {
    this.store = new Store<TokenStoreSchema>({
      name: 'tokens',
      defaults: {}
    })
  }

  private encrypt(value: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(value).toString('base64')
    }
    // Fallback: base64 only (no hardware encryption available)
    return Buffer.from(value).toString('base64')
  }

  private decrypt(encoded: string): string {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
      }
      return Buffer.from(encoded, 'base64').toString()
    } catch (err) {
      log.error('Token decryption failed:', err)
      return ''
    }
  }

  saveTokens(
    platform: 'twitch' | 'youtube',
    accessToken: string,
    opts?: { refreshToken?: string; username?: string; userId?: string; expiresIn?: number }
  ): void {
    const entry: TokenEntry = {
      encryptedAccessToken: this.encrypt(accessToken),
      username: opts?.username,
      userId: opts?.userId,
      expiresAt: opts?.expiresIn ? Date.now() + opts.expiresIn * 1000 : undefined
    }
    if (opts?.refreshToken) {
      entry.encryptedRefreshToken = this.encrypt(opts.refreshToken)
    }
    this.store.set(platform, entry)
    log.info(`Saved ${platform} tokens for user: ${opts?.username}`)
  }

  getAccessToken(platform: 'twitch' | 'youtube'): string | null {
    const entry = this.store.get(platform)
    if (!entry) return null
    if (entry.expiresAt && Date.now() > entry.expiresAt - 60_000) {
      return null // expired (or within 1 min of expiry)
    }
    return this.decrypt(entry.encryptedAccessToken) || null
  }

  getRefreshToken(platform: 'twitch' | 'youtube'): string | null {
    const entry = this.store.get(platform)
    if (!entry?.encryptedRefreshToken) return null
    return this.decrypt(entry.encryptedRefreshToken) || null
  }

  getUserInfo(platform: 'twitch' | 'youtube'): { username?: string; userId?: string } {
    const entry = this.store.get(platform)
    return { username: entry?.username, userId: entry?.userId }
  }

  async clearTokens(platform: 'twitch' | 'youtube'): Promise<void> {
    this.store.delete(platform)
    log.info(`Cleared ${platform} tokens`)
  }

  getAuthState(platform: 'twitch' | 'youtube'): AuthState {
    const entry = this.store.get(platform)
    if (!entry) return { status: 'unauthenticated' }
    const token = this.getAccessToken(platform)
    if (!token) return { status: 'unauthenticated' }
    return {
      status: 'authenticated',
      username: entry.username
    }
  }
}

export const tokenStore = new TokenStore()
