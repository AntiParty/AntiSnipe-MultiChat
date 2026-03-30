import { memo } from 'react'
import { clsx } from 'clsx'
import PlatformBadge from './PlatformBadge'
import BadgeList from './BadgeList'
import Timestamp from './Timestamp'
import MessageContent from './MessageContent'
import styles from '../../styles/chat.module.css'
import { colorHash } from '../../utils/colorHash'
import { useStore } from '../../store'
import type { NormalizedMessage } from '@shared/types/message'

interface MessageRowProps {
  message: NormalizedMessage
}

function MessageRow({ message }: MessageRowProps) {
  const showTimestamps = useStore(s => s.settings.showTimestamps)
  const showBadges = useStore(s => s.settings.showBadges)
  const showPlatformBadge = useStore(s => s.settings.showPlatformBadge)

  const { messageType, isHighlighted, isMention, isAction, isDeleted } = message

  // Special rendering for system-type messages
  if (
    messageType === 'sub' ||
    messageType === 'resub' ||
    messageType === 'giftsub' ||
    messageType === 'announcement'
  ) {
    return (
      <div className={styles.subMessage}>
        <MessageContent parts={message.parts} />
      </div>
    )
  }

  if (messageType === 'raid') {
    return (
      <div className={styles.raidMessage}>
        <MessageContent parts={message.parts} />
      </div>
    )
  }

  if (messageType === 'system') {
    return (
      <div className={styles.systemMessage}>
        <MessageContent parts={message.parts} />
      </div>
    )
  }

  const authorColor = message.authorColor || colorHash(message.authorName)

  return (
    <div
      className={clsx(styles.messageRow, {
        [styles.highlighted]: isHighlighted && !isMention,
        [styles.mention]: isMention,
        [styles.deleted]: isDeleted,
        [styles.action]: isAction
      })}
    >
      {showPlatformBadge && <PlatformBadge platform={message.platform} />}
      {showTimestamps && <Timestamp timestamp={message.timestamp} />}
      {showBadges && <BadgeList badges={message.badges} />}

      <span
        className={styles.authorName}
        style={{ color: authorColor }}
        title={`${message.authorName} (${message.platform})`}
      >
        {message.authorDisplayName}
      </span>

      <span className={styles.colon}>:</span>

      <MessageContent parts={message.parts} />
    </div>
  )
}

export default memo(MessageRow, (prev, next) => prev.message.id === next.message.id && prev.message.isDeleted === next.message.isDeleted)
