import EmoteImage from './EmoteImage'
import styles from '../../styles/chat.module.css'
import type { MessagePart } from '@shared/types/message'

interface MessageContentProps {
  parts: MessagePart[]
}

export default function MessageContent({ parts }: MessageContentProps) {
  return (
    <span className="select-text">
      {parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return <span key={i}>{part.content}</span>

          case 'emote':
            return <EmoteImage key={i} emote={part.emote} />

          case 'mention':
            return (
              <span key={i} className={styles.mentionPart}>
                {part.content}
              </span>
            )

          case 'link':
            return (
              <span
                key={i}
                className={styles.linkPart}
                onClick={() =>
                  window.chatBridge.invoke('shell:openExternal', { url: part.url })
                }
                role="link"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ')
                    window.chatBridge.invoke('shell:openExternal', { url: part.url })
                }}
              >
                {part.display}
              </span>
            )

          default:
            return null
        }
      })}
    </span>
  )
}
