import type { EmoteData } from '../../shared/types/emote'

/**
 * Resolves emote names to EmoteData.
 * Priority: 7TV > BTTV > FFZ > Twitch native
 * Scope: channel-specific emotes take priority over global.
 */
class EmoteResolver {
  // name → EmoteData, per channel
  private channelMaps = new Map<string, Map<string, EmoteData>>()
  // global emotes (shared across all channels)
  private globalMap = new Map<string, EmoteData>()

  setChannelEmotes(channelId: string, emotes: EmoteData[]): void {
    const map = new Map<string, EmoteData>()
    // Load in reverse priority order so higher-priority providers overwrite
    const byPriority = [...emotes].sort((a, b) => priority(a.provider) - priority(b.provider))
    for (const emote of byPriority) {
      map.set(emote.name, emote)
    }
    this.channelMaps.set(channelId, map)
  }

  setGlobalEmotes(emotes: EmoteData[]): void {
    this.globalMap.clear()
    const byPriority = [...emotes].sort((a, b) => priority(a.provider) - priority(b.provider))
    for (const emote of byPriority) {
      this.globalMap.set(emote.name, emote)
    }
  }

  resolve(name: string, channelId: string): EmoteData | undefined {
    return this.channelMaps.get(channelId)?.get(name) ?? this.globalMap.get(name)
  }

  clearChannel(channelId: string): void {
    this.channelMaps.delete(channelId)
  }

  getAllForChannel(channelId: string): EmoteData[] {
    const result = new Map<string, EmoteData>(this.globalMap)
    const channelMap = this.channelMaps.get(channelId)
    if (channelMap) {
      for (const [name, emote] of channelMap) {
        result.set(name, emote)
      }
    }
    return Array.from(result.values())
  }
}

function priority(provider: EmoteData['provider']): number {
  switch (provider) {
    case '7tv': return 4
    case 'bttv': return 3
    case 'ffz': return 2
    case 'twitch': return 1
    case 'kick': return 1
    default: return 0
  }
}

export const emoteResolver = new EmoteResolver()
