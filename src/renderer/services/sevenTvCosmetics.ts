import { useState, useEffect } from 'react'
import type React from 'react'
import type { SevenTvCosmeticsResult, SevenTvBadgeResult, SevenTvPaintResult } from '@shared/types/ipc'

// Re-export the shared types under friendlier names used by the renderer
export type SevenTvBadgeData = SevenTvBadgeResult
export type SevenTvPaintData = SevenTvPaintResult
export type SevenTvUserCosmetics = SevenTvCosmeticsResult

// ─── In-memory cache ──────────────────────────────────────────────────────────

export const cosmeticsCache = new Map<string, SevenTvUserCosmetics>()
const pending = new Map<string, Promise<SevenTvUserCosmetics>>()
const listeners = new Set<(userId: string) => void>()

export function subscribeCosmeticsUpdate(fn: (userId: string) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ─── Fetch (via IPC → main process, avoids CSP) ───────────────────────────────

export async function fetchSevenTvCosmetics(twitchUserId: string): Promise<SevenTvUserCosmetics> {
  if (cosmeticsCache.has(twitchUserId)) return cosmeticsCache.get(twitchUserId)!
  if (pending.has(twitchUserId)) return pending.get(twitchUserId)!

  const empty: SevenTvUserCosmetics = { badge: null, paint: null }

  const promise = (async (): Promise<SevenTvUserCosmetics> => {
    try {
      const result = await window.chatBridge.invoke('7tv:fetchCosmetics', { twitchUserId })
      cosmeticsCache.set(twitchUserId, result)
      pending.delete(twitchUserId)
      listeners.forEach(fn => fn(twitchUserId))
      return result
    } catch {
      cosmeticsCache.set(twitchUserId, empty)
      pending.delete(twitchUserId)
      return empty
    }
  })()

  pending.set(twitchUserId, promise)
  return promise
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useSevenTvCosmetics(
  twitchUserId: string | undefined,
  enabled: boolean
): SevenTvUserCosmetics | null {
  const [cosmetics, setCosmetics] = useState<SevenTvUserCosmetics | null>(
    twitchUserId ? (cosmeticsCache.get(twitchUserId) ?? null) : null
  )

  useEffect(() => {
    if (!enabled || !twitchUserId) return

    if (cosmeticsCache.has(twitchUserId)) {
      setCosmetics(cosmeticsCache.get(twitchUserId)!)
      return
    }

    const unsub = subscribeCosmeticsUpdate(uid => {
      if (uid === twitchUserId) setCosmetics(cosmeticsCache.get(uid) ?? null)
    })

    fetchSevenTvCosmetics(twitchUserId)
    return () => { unsub() }
  }, [twitchUserId, enabled])

  return enabled ? cosmetics : null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rgbaIntToCss(colorInt: number): string {
  const u = colorInt >>> 0
  const r = (u >>> 24) & 0xff
  const g = (u >>> 16) & 0xff
  const b = (u >>> 8) & 0xff
  const a = (u & 0xff) / 255
  return `rgba(${r},${g},${b},${a.toFixed(3)})`
}

export function paintToStyle(paint: SevenTvPaintData): React.CSSProperties {
  const fn = paint.function

  if ((fn === 'LINEAR_GRADIENT' || fn === 'RADIAL_GRADIENT') && paint.stops?.length >= 2) {
    const stops = paint.stops
      .map(s => `${rgbaIntToCss(s.color)} ${(s.at * 100).toFixed(1)}%`)
      .join(', ')

    const image =
      fn === 'LINEAR_GRADIENT'
        ? `linear-gradient(${paint.angle ?? 90}deg, ${stops})`
        : `radial-gradient(circle, ${stops})`

    const shadow = paint.shadows?.length
      ? `drop-shadow(${paint.shadows[0].x_offset}px ${paint.shadows[0].y_offset}px ${paint.shadows[0].radius}px ${rgbaIntToCss(paint.shadows[0].color)})`
      : undefined

    return {
      backgroundImage: image,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
      ...(shadow ? { filter: shadow } : {})
    }
  }

  if (paint.color !== null && paint.color !== 0) {
    return { color: rgbaIntToCss(paint.color) }
  }

  return {}
}

export function sevenTvBadgeUrl(badge: SevenTvBadgeData): string {
  return badge.imageUrl ?? ''
}
