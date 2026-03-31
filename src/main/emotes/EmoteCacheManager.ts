import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import log from 'electron-log'
import { emoteResolver } from './EmoteResolver'
import { fetchSevenTvChannelEmotes, fetchSevenTvGlobalEmotes } from './providers/SevenTvProvider'
import { fetchBttvChannelEmotes, fetchBttvGlobalEmotes } from './providers/BttvProvider'
import { fetchFfzChannelEmotes, fetchFfzGlobalEmotes } from './providers/FfzProvider'
import { broadcaster } from '../ipc/broadcaster'
import { settingsStore } from '../store/SettingsStore'
import { EMOTE_CACHE_TTL_MS, EMOTE_CACHE_FLUSH_INTERVAL_MS, EMOTE_CACHE_VERSION } from '../../shared/constants'
import type { EmoteData, SerializedEmoteCache } from '../../shared/types/emote'
import type { FetchEmotesPayload } from '../../shared/types/ipc'
import { RENDERER_CHANNELS as IPC_CHANNELS } from '../../shared/types/ipc'

class EmoteCacheManager {
  private cachePath: string
  private cache: SerializedEmoteCache = {
    version: EMOTE_CACHE_VERSION,
    timestamp: 0,
    channels: {},
    global: { fetchedAt: 0, sevenTv: [], bttv: [], ffz: [] }
  }
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private globalLoaded = false

  constructor() {
    this.cachePath = join(app.getPath('userData'), 'emote-cache.json')
  }

  loadFromDisk(): void {
    try {
      if (existsSync(this.cachePath)) {
        const raw = readFileSync(this.cachePath, 'utf8')
        const parsed = JSON.parse(raw) as SerializedEmoteCache
        if (parsed.version === EMOTE_CACHE_VERSION) {
          this.cache = parsed
          // Restore global emotes if fresh enough
          const global = this.cache.global
          if (Date.now() - global.fetchedAt < EMOTE_CACHE_TTL_MS) {
            const globalEmotes = [...global.sevenTv, ...global.bttv, ...global.ffz]
            emoteResolver.setGlobalEmotes(globalEmotes)
            this.globalLoaded = true
            log.info(`Loaded ${globalEmotes.length} global emotes from disk cache`)
          }
        }
      }
    } catch (err) {
      log.error('Failed to load emote cache from disk:', err)
    }

    this.flushTimer = setInterval(() => this.flushToDisk(), EMOTE_CACHE_FLUSH_INTERVAL_MS)
  }

  flushToDisk(): void {
    try {
      writeFileSync(this.cachePath, JSON.stringify(this.cache), 'utf8')
    } catch (err) {
      log.error('Failed to flush emote cache to disk:', err)
    }
  }

  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flushToDisk()
  }

  async fetchGlobalEmotes(): Promise<void> {
    const settings = settingsStore.get()
    const enabled = settings.enabledProviders

    const results = await Promise.allSettled([
      enabled.sevenTv ? fetchSevenTvGlobalEmotes() : Promise.resolve([] as EmoteData[]),
      enabled.bttv ? fetchBttvGlobalEmotes() : Promise.resolve([] as EmoteData[]),
      enabled.ffz ? fetchFfzGlobalEmotes() : Promise.resolve([] as EmoteData[])
    ])

    const [sevenTv, bttv, ffz] = results.map(r => (r.status === 'fulfilled' ? r.value : []))

    this.cache.global = {
      fetchedAt: Date.now(),
      sevenTv,
      bttv,
      ffz
    }

    emoteResolver.setGlobalEmotes([...sevenTv, ...bttv, ...ffz])
    this.globalLoaded = true
    log.info(`Fetched global emotes: 7TV=${sevenTv.length}, BTTV=${bttv.length}, FFZ=${ffz.length}`)
  }

  async fetchForChannel(payload: FetchEmotesPayload): Promise<void> {
    const { channelId, twitchUserId, kickUserId } = payload
    const settings = settingsStore.get()
    const enabled = settings.enabledProviders

    // Check disk cache freshness
    const cached = this.cache.channels[channelId]
    if (cached && Date.now() - cached.fetchedAt < EMOTE_CACHE_TTL_MS) {
      emoteResolver.setChannelEmotes(channelId, cached.emotes)
      broadcaster.send(IPC_CHANNELS.EMOTE_BATCH_READY, {
        channelId,
        emotes: cached.emotes
      })
      log.info(`Restored ${cached.emotes.length} emotes for ${channelId} from disk cache`)
      if (!this.globalLoaded) await this.fetchGlobalEmotes()
      return
    }

    if (!this.globalLoaded) await this.fetchGlobalEmotes()

    const promises: Promise<EmoteData[]>[] = []

    if (twitchUserId) {
      if (enabled.sevenTv) promises.push(fetchSevenTvChannelEmotes('twitch', twitchUserId))
      if (enabled.bttv) promises.push(fetchBttvChannelEmotes('twitch', twitchUserId))
      if (enabled.ffz) promises.push(fetchFfzChannelEmotes(twitchUserId))
    } else if (kickUserId) {
      if (enabled.sevenTv) promises.push(fetchSevenTvChannelEmotes('kick', kickUserId))
      if (enabled.bttv) promises.push(fetchBttvChannelEmotes('kick', kickUserId))
    }

    const results = await Promise.allSettled(promises)
    const allEmotes = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))

    emoteResolver.setChannelEmotes(channelId, allEmotes)

    this.cache.channels[channelId] = {
      channelId,
      fetchedAt: Date.now(),
      emotes: allEmotes
    }

    broadcaster.send(IPC_CHANNELS.EMOTE_BATCH_READY, {
      channelId,
      emotes: allEmotes
    })

    log.info(`Fetched ${allEmotes.length} channel emotes for ${channelId}`)
  }
}

export const emoteCacheManager = new EmoteCacheManager()
