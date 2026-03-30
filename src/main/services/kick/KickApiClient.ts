import log from 'electron-log'
import { KICK_API_BASE } from '../../../shared/constants'

interface KickChannel {
  id: number
  slug: string
  chatroom: {
    id: number
    chatable_id: number
  }
  user: {
    id: number
    username: string
  }
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export class KickApiClient {
  private chatroomCache = new Map<string, number>()

  async getChannel(slug: string): Promise<KickChannel | null> {
    try {
      const resp = await fetch(`${KICK_API_BASE}/channels/${slug}`, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      })
      if (!resp.ok) {
        log.error(`Kick API ${slug} returned ${resp.status}`)
        return null
      }
      return (await resp.json()) as KickChannel
    } catch (err) {
      log.error('Kick getChannel failed:', err)
      return null
    }
  }

  async getChatroomId(slug: string): Promise<number | null> {
    if (this.chatroomCache.has(slug)) return this.chatroomCache.get(slug)!
    const channel = await this.getChannel(slug)
    if (!channel) return null
    const id = channel.chatroom.id
    this.chatroomCache.set(slug, id)
    return id
  }

  async sendMessage(slug: string, message: string, sessionCookie: string): Promise<boolean> {
    if (!sessionCookie) {
      log.warn('Kick send: no session cookie available')
      return false
    }
    try {
      const resp = await fetch(`${KICK_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'User-Agent': BROWSER_UA,
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
          'X-Socket-Id': ''
        },
        body: JSON.stringify({ chatroom_id: await this.getChatroomId(slug), content: message, type: 'message' })
      })
      return resp.ok
    } catch {
      return false
    }
  }
}

export const kickApiClient = new KickApiClient()
