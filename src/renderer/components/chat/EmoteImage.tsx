import { useState } from 'react'
import { useStore } from '../../store'
import styles from '../../styles/chat.module.css'
import type { EmoteData } from '@shared/types/emote'

interface EmoteImageProps {
  emote: EmoteData
}

function resolveUrl(url: string, shouldAnimate: boolean, isAnimated: boolean): string {
  // For 7TV animated emotes, swap .gif → .webp for the static version
  if (!shouldAnimate && isAnimated && url.endsWith('.gif')) {
    return url.slice(0, -4) + '.webp'
  }
  return url
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
    <img
      src={x2}
      srcSet={`${x1} 1x, ${x2} 2x, ${x4} 4x`}
      alt={emote.name}
      title={`:${emote.name}:`}
      className={styles.emote}
      loading="lazy"
      onError={() => setErrored(true)}
      draggable={false}
    />
  )
}
