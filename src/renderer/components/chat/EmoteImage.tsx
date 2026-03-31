import { useState } from 'react'
import { useStore } from '../../store'
import Tooltip from '../ui/Tooltip'
import styles from '../../styles/chat.module.css'
import type { EmoteData, EmoteProvider } from '@shared/types/emote'

interface EmoteImageProps {
  emote: EmoteData
}

const PROVIDER_LABELS: Record<EmoteProvider, string> = {
  '7tv': '7TV',
  bttv: 'BetterTTV',
  ffz: 'FrankerFaceZ',
  twitch: 'Twitch',
  kick: 'Kick'
}

const PROVIDER_COLORS: Record<EmoteProvider, string> = {
  '7tv': '#40a8ca',
  bttv: '#d50014',
  ffz: '#4c90d3',
  twitch: '#9147ff',
  kick: '#53fc18'
}

function resolveUrl(url: string, shouldAnimate: boolean, isAnimated: boolean): string {
  if (!shouldAnimate && isAnimated && url.endsWith('.gif')) {
    return url.slice(0, -4) + '.webp'
  }
  return url
}

function EmoteTooltip({ emote }: { emote: EmoteData }) {
  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '100px' }}>
      <img
        src={emote.urls.x4 || emote.urls.x2}
        alt={emote.name}
        style={{ maxWidth: '80px', maxHeight: '80px', objectFit: 'contain', imageRendering: 'pixelated' }}
        draggable={false}
      />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
          :{emote.name}:
        </div>
        <div style={{
          display: 'inline-block',
          fontSize: '10px',
          fontWeight: 600,
          padding: '1px 6px',
          borderRadius: '3px',
          background: `${PROVIDER_COLORS[emote.provider]}22`,
          color: PROVIDER_COLORS[emote.provider],
          border: `1px solid ${PROVIDER_COLORS[emote.provider]}44`
        }}>
          {PROVIDER_LABELS[emote.provider]}
        </div>
        {emote.animated && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>animated</div>
        )}
      </div>
    </div>
  )
}

export default function EmoteImage({ emote }: EmoteImageProps) {
  const [errored, setErrored] = useState(false)
  const animateEmotes = useStore(s => s.settings.animateEmotes)
  const windowFocused = useStore(s => s.windowFocused)

  const shouldAnimate =
    animateEmotes === 'always' ||
    (animateEmotes === 'focused' && windowFocused)

  if (errored) {
    return <span className={styles.mentionPart}>{emote.name}</span>
  }

  const x1 = resolveUrl(emote.urls.x1, shouldAnimate, emote.animated)
  const x2 = resolveUrl(emote.urls.x2, shouldAnimate, emote.animated)
  const x4 = resolveUrl(emote.urls.x4, shouldAnimate, emote.animated)

  return (
    <Tooltip content={<EmoteTooltip emote={emote} />} side="top" delayMs={600}>
      <span style={{ display: 'inline-block', lineHeight: 0, verticalAlign: 'middle' }}>
        <img
          src={x2}
          srcSet={`${x1} 1x, ${x2} 2x, ${x4} 4x`}
          alt={emote.name}
          className={styles.emote}
          loading="lazy"
          onError={() => setErrored(true)}
          draggable={false}
          style={{ display: 'block' }}
        />
      </span>
    </Tooltip>
  )
}
