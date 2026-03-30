import { net } from 'electron'
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

// electron.net.fetch uses Chromium's networking stack which handles Cloudflare correctly.
// Node.js fetch gets blocked; this does not.
async function kickFetch(url: string): Promise<Response> {
  return net.fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://kick.com/',
      'Origin': 'https://kick.com/'
    }
  })
}

export class KickApiClient {
  private chatroomCache = new Map<string, number>()

  async getChannel(slug: string): Promise<KickChannel | null> {
    try {
      const resp = await kickFetch(`${KICK_API_BASE}/channels/${slug}`)
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
      const chatroomId = await this.getChatroomId(slug)
      if (!chatroomId) return false
      const resp = await net.fetch(`${KICK_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
          'Referer': 'https://kick.com/',
          'Origin': 'https://kick.com/'
        },
        body: JSON.stringify({ chatroom_id: chatroomId, content: message, type: 'message' })
      })
      return resp.ok
    } catch {
      return false
    }
  }
}

export const kickApiClient = new KickApiClient()
