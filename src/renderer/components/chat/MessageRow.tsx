import { memo } from 'react'
import { clsx } from 'clsx'
import MessageContent from './MessageContent'
import styles from '../../styles/chat.module.css'
import { colorHash } from '../../utils/colorHash'
import { formatTimestamp } from '../../utils/timeFormat'
import { useStore } from '../../store'
import type { NormalizedMessage, BadgeInfo } from '@shared/types/message'
import type { Platform } from '@shared/types/message'

const PLATFORM_DOT_COLORS: Record<Platform, string> = {
  twitch: '#9147ff',
  youtube: '#cc0000',
  kick: '#53fc18'
}
const PLATFORM_LABELS: Record<Platform, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick'
}

interface MessageRowProps {
  message: NormalizedMessage
}

function InlineBadges({ badges }: { badges: BadgeInfo[] }) {
  if (!badges.length) return null
  return (
    <span className={styles.badgeList}>
      {badges.map((b, i) =>
        b.imageUrl ? (
          <img
            key={i}
            src={b.imageUrl}
            alt={b.title}
            title={b.title}
            className={styles.badge}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <span
            key={i}
            title={b.title}
            style={{
              display: 'inline-block',
              fontSize: '9px',
              padding: '0 2px',
              background: 'var(--surface-3)',
              color: 'var(--text-muted)',
              verticalAlign: 'middle',
              marginRight: '1px',
              lineHeight: '13px',
            }}
          >
            {b.id === 'moderator' ? 'MOD' : b.id === 'owner' ? 'OWN' : b.title.slice(0, 3).toUpperCase()}
          </span>
        )
      )}
    </span>
  )
}

function MessageRow({ message }: MessageRowProps) {
  const showTimestamps = useStore(s => s.settings.showTimestamps)
  const showBadges = useStore(s => s.settings.showBadges)
  const showPlatformBadge = useStore(s => s.settings.showPlatformBadge)

  const { messageType, isHighlighted, isMention, isAction, isDeleted } = message

  if (messageType === 'sub' || messageType === 'resub' || messageType === 'giftsub' || messageType === 'announcement') {
    return <div className={styles.subMessage}><MessageContent parts={message.parts} /></div>
  }
  if (messageType === 'raid') {
    return <div className={styles.raidMessage}><MessageContent parts={message.parts} /></div>
  }
  if (messageType === 'system') {
    return <div className={styles.systemMessage}><MessageContent parts={message.parts} /></div>
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
      {/* All inline — flows as a single line that wraps naturally */}
      {showTimestamps && (
        <span className={styles.timestamp}>
          {formatTimestamp(message.timestamp)}
        </span>
      )}

      {showPlatformBadge && (
        <span
          className={styles.platformDot}
          style={{ background: PLATFORM_DOT_COLORS[message.platform] }}
          title={PLATFORM_LABELS[message.platform]}
        />
      )}

      {showBadges && <InlineBadges badges={message.badges} />}

      <span
        className={styles.authorName}
        style={{ color: authorColor }}
        title={`${message.authorName} (${message.platform})`}
      >
        {message.authorDisplayName}
      </span>

      <span className={styles.colon}>: </span>

      <span className={clsx(styles.messageBody, 'select-text')}>
        <MessageContent parts={message.parts} />
      </span>
    </div>
  )
}

export default memo(
  MessageRow,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.isDeleted === next.message.isDeleted
)
