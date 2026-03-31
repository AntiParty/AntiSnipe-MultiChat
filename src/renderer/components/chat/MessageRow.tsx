import { memo, useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { Trash2, Clock, Ban, ShieldOff } from 'lucide-react'
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

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${secs / 60}m`
  if (secs < 86400) return `${secs / 3600}h`
  return `${secs / 86400}d`
}

interface MessageRowProps {
  message: NormalizedMessage
  index: number
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

function MessageRow({ message, index }: MessageRowProps) {
  const showTimestamps = useStore(s => s.settings.showTimestamps)
  const timestampFormat = useStore(s => s.settings.timestampFormat)
  const showBadges = useStore(s => s.settings.showBadges)
  const showPlatformBadge = useStore(s => s.settings.showPlatformBadge)
  const alternatingRows = useStore(s => s.settings.alternatingRows)
  const usernameDisplay = useStore(s => s.settings.usernameDisplay)
  const showDeletedMessages = useStore(s => s.settings.showDeletedMessages)
  const hideCommands = useStore(s => s.settings.hideCommands)
  const showReplyContext = useStore(s => s.settings.showReplyContext)
  const modButtons = useStore(s => s.settings.modButtons)
  const isMod = useStore(s => s.selfModByChannel[message.channelId] ?? false)

  const [hovered, setHovered] = useState(false)
  const [timeoutOpen, setTimeoutOpen] = useState(false)

  const { messageType, isHighlighted, isMention, isAction, isDeleted, raw } = message

  const fireModAction = useCallback(
    async (action: 'delete' | 'timeout' | 'ban' | 'unban', duration?: number) => {
      try {
        await window.chatBridge.invoke('mod:action', {
          channelId: message.channelId,
          action,
          targetUserId: message.authorId,
          targetUserLogin: message.authorName,
          messageId: message.id,
          duration
        })
      } catch (err) {
        console.error('Mod action failed:', action, err)
      }
    },
    [message.channelId, message.authorId, message.authorName, message.id]
  )

  // Hide command messages if setting enabled
  if (hideCommands && raw && (raw.startsWith('/') || raw.startsWith('!'))) {
    return null
  }

  // Hide deleted messages entirely if setting is 'hide'
  if (isDeleted && showDeletedMessages === 'hide') {
    return null
  }

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

  let displayedName: string
  if (usernameDisplay === 'login') {
    displayedName = message.authorName
  } else if (usernameDisplay === 'both' && message.authorDisplayName !== message.authorName) {
    displayedName = `${message.authorDisplayName} (${message.authorName})`
  } else {
    displayedName = message.authorDisplayName
  }

  const rowBg = alternatingRows && index % 2 === 1 ? 'var(--surface-1)' : undefined

  // Only show mod actions for Twitch chat messages with a real Twitch message ID.
  // Self-injected optimistic messages use a "self-..." synthetic ID and are never
  // stored on Twitch's side, so delete/timeout/ban against them would 404.
  const hasRealMessageId = !message.id.startsWith('self-')
  const showModActions = isMod && message.platform === 'twitch' && message.authorId && !isDeleted && hasRealMessageId

  return (
    <div
      className={clsx(styles.messageRow, {
        [styles.highlighted]: isHighlighted && !isMention,
        [styles.mention]: isMention,
        [styles.deleted]: isDeleted,
        [styles.action]: isAction
      })}
      style={{
        background: rowBg,
        paddingTop: 'var(--row-padding-y, 1px)',
        paddingBottom: 'var(--row-padding-y, 1px)'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTimeoutOpen(false) }}
    >
      {showReplyContext && message.replyTo && (
        <div className={styles.replyBar}>
          <span className={styles.replyAuthor}>
            ↩ @{message.replyTo.userDisplayName || message.replyTo.userLogin}
          </span>
          {message.replyTo.msgBody && (
            <span className={styles.replySnippet}>{': '}{message.replyTo.msgBody}</span>
          )}
        </div>
      )}

      {showTimestamps && (
        <span className={styles.timestamp}>
          {formatTimestamp(message.timestamp, timestampFormat)}
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
        {displayedName}
      </span>

      <span className={styles.colon}>: </span>

      <span className={clsx(styles.messageBody, 'select-text')}>
        <MessageContent parts={message.parts} />
      </span>

      {showModActions && hovered && (
        <span className={styles.modActions}>
          {modButtons.showDelete && (
            <button
              className={styles.modBtn}
              title="Delete message"
              onClick={e => { e.stopPropagation(); fireModAction('delete') }}
            >
              <Trash2 size={10} />
            </button>
          )}

          {modButtons.showTimeout && (
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                className={styles.modBtn}
                title="Timeout user"
                onClick={e => { e.stopPropagation(); setTimeoutOpen(v => !v) }}
              >
                <Clock size={10} />
              </button>
              {timeoutOpen && (
                <span className={styles.timeoutMenu}>
                  {modButtons.timeoutPresets.map(secs => (
                    <button
                      key={secs}
                      className={styles.timeoutOption}
                      onClick={e => {
                        e.stopPropagation()
                        setTimeoutOpen(false)
                        fireModAction('timeout', secs)
                      }}
                    >
                      {formatDuration(secs)}
                    </button>
                  ))}
                </span>
              )}
            </span>
          )}

          {modButtons.showBan && (
            isDeleted ? (
              <button
                className={styles.modBtn}
                title="Unban user"
                onClick={e => { e.stopPropagation(); fireModAction('unban') }}
              >
                <ShieldOff size={10} />
              </button>
            ) : (
              <button
                className={clsx(styles.modBtn, styles.modBtnDanger)}
                title="Ban user"
                onClick={e => { e.stopPropagation(); fireModAction('ban') }}
              >
                <Ban size={10} />
              </button>
            )
          )}
        </span>
      )}
    </div>
  )
}

export default memo(
  MessageRow,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.isDeleted === next.message.isDeleted &&
    prev.index === next.index
)
