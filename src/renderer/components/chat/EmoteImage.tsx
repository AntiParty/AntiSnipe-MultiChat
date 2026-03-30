import { useState } from 'react'
import styles from '../../styles/chat.module.css'
import type { EmoteData } from '@shared/types/emote'

interface EmoteImageProps {
  emote: EmoteData
}

export default function EmoteImage({ emote }: EmoteImageProps) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return <span className={styles.mentionPart}>{emote.name}</span>
  }

  return (
    <img
      src={emote.urls.x2}
      srcSet={`${emote.urls.x1} 1x, ${emote.urls.x2} 2x, ${emote.urls.x4} 4x`}
      alt={emote.name}
      title={`:${emote.name}:`}
      className={styles.emote}
      loading="lazy"
      onError={() => setErrored(true)}
      draggable={false}
    />
  )
}
