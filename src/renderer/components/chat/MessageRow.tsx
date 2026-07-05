import { memo, useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { Trash2, Ban, ShieldOff } from 'lucide-react'
import MessageContent from './MessageContent'
import { PlatformLogo } from '../ui/PlatformLogos'
import styles from '../../styles/chat.module.css'
import { colorHash, readableColor } from '../../utils/colorHash'
import { formatTimestamp } from '../../utils/timeFormat'
import { useStore } from '../../store'
import { useSevenTvCosmetics, paintToStyle, sevenTvBadgeUrl } from '../../services/sevenTvCosmetics'
import type { NormalizedMessage, BadgeInfo } from '@shared/types/message'
import type { Platform } from '@shared/types/message'

const PLATFORM_DOT_COLORS: Record<Platform, string> = {
  twitch: '#9147ff',
  youtube: '#cc0000',
  kick: '#53fc18',
  tiktok: '#ff0050'
}
const PLATFORM_LABELS: Record<Platform, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick',
  tiktok: 'TikTok'
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
  const dimSharedChatMessages = useStore(s => s.settings.dimSharedChatMessages)
  const modButtons = useStore(s => s.settings.modButtons)
  const clickableUsernames = useStore(s => s.settings.clickableUsernames)
  const show7tvBadges = useStore(s => s.settings.show7tvBadges)
  const show7tvPaints = useStore(s => s.settings.show7tvPaints)
  const loggedInUsername = useStore(s => s.auth.twitch.username)
  const isMod = useStore(s => s.selfModByChannel[message.channelId] ?? false)

  const sevenTvEnabled = (show7tvBadges || show7tvPaints) && message.platform === 'twitch'
  const sevenTvCosmetics = useSevenTvCosmetics(
    sevenTvEnabled ? message.authorId : undefined,
    sevenTvEnabled
  )

  // Is this message a reply directed at the currently logged-in user?
  const isReplyToMe =
    !!message.replyTo &&
    !!loggedInUsername &&
    message.replyTo.userLogin?.toLowerCase() === loggedInUsername.toLowerCase()

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

  const pluginAction = message.pluginAction

  // Plugin: hide message
  if (pluginAction?.type === 'hide') return null

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

  const isRedeem = messageType === 'redeem'

  // 7TV paint overrides the username color entirely
  const paintStyle =
    show7tvPaints && sevenTvCosmetics?.paint
      ? paintToStyle(sevenTvCosmetics.paint)
      : null

  // Boost dark Twitch colors to be readable on dark backgrounds
  const authorColor = message.authorColor
    ? readableColor(message.authorColor)
    : colorHash(message.authorName)

  let displayedName: string
  if (usernameDisplay === 'login') {
    displayedName = message.authorName
  } else if (usernameDisplay === 'both' && message.authorDisplayName !== message.authorName) {
    displayedName = `${message.authorDisplayName} (${message.authorName})`
  } else {
    displayedName = message.authorDisplayName
  }

  const rowBg = pluginAction?.type === 'highlight'
    ? pluginAction.color
    : message.isFirstMessage
      ? 'rgba(80, 200, 120, 0.10)'
      : alternatingRows && index % 2 === 1 ? 'var(--surface-1)' : undefined

  // Show mod actions for mods on real (non-optimistic) messages.
  // Twitch and YouTube both support delete/timeout/ban via their APIs.
  const hasRealMessageId = !message.id.startsWith('self-')
  const platformSupportsMod = message.platform === 'twitch' || message.platform === 'youtube'
  const showModActions = isMod && platformSupportsMod && !!message.authorId && hasRealMessageId
  // YouTube's API can't unban (needs the ban resource id we don't keep)
  const supportsUnban = message.platform === 'twitch'

  return (
    <div
      className={clsx(styles.messageRow, {
        [styles.highlighted]: isHighlighted && !isMention && !isRedeem,
        [styles.mention]: isMention,
        [styles.deleted]: isDeleted,
        [styles.action]: isAction,
        [styles.redeem]: isRedeem
      })}
      style={{
        background: rowBg,
        paddingTop: 'var(--row-padding-y, 1px)',
        paddingBottom: 'var(--row-padding-y, 1px)',
        opacity: message.isHistorical
          ? 0.55
          : dimSharedChatMessages && message.sharedSource
            ? 0.5
            : undefined
      }}
      onMouseLeave={() => setTimeoutOpen(false)}
    >
      {showReplyContext && message.replyTo && (
        <div className={clsx(styles.replyBar, { [styles.replyToMe]: isReplyToMe })}>
          {/* Chatterino-style curved L-connector */}
          <svg
            className={styles.replyConnector}
            width="12"
            height="13"
            viewBox="0 0 12 13"
            fill="none"
            aria-hidden
          >
            <path
              d="M2 13 L2 5 Q2 2 5 2 L12 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.replyAuthor}>
            @{message.replyTo.userDisplayName || message.replyTo.userLogin}
          </span>
          {message.replyTo.msgBody && (
            <span className={styles.replySnippet}>: {message.replyTo.msgBody}</span>
          )}
        </div>
      )}

      {/* Flex row: [mod buttons] [inline message content] */}
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>

        {showModActions && (
          <span className={styles.modActionsLeft}>
            {modButtons.showDelete && !isDeleted && (
              <button
                className={styles.modBtn}
                title="Delete message"
                onClick={e => { e.stopPropagation(); fireModAction('delete') }}
              >
                <Trash2 size={10} />
              </button>
            )}

            {modButtons.showTimeout && !isDeleted && (
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  className={styles.modBtn}
                  title={`Timeout ${formatDuration(modButtons.timeoutPresets[0] ?? 600)} — right-click for more durations`}
                  onClick={e => {
                    e.stopPropagation()
                    setTimeoutOpen(false)
                    fireModAction('timeout', modButtons.timeoutPresets[0] ?? 600)
                  }}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setTimeoutOpen(v => !v) }}
                  style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '-0.02em' }}
                >
                  {formatDuration(modButtons.timeoutPresets[0] ?? 600)}
                </button>
                {timeoutOpen && (
                  <span className={styles.timeoutMenuLeft}>
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
                supportsUnban && (
                <button
                  className={styles.modBtn}
                  title="Unban user"
                  onClick={e => { e.stopPropagation(); fireModAction('unban') }}
                >
                  <ShieldOff size={10} />
                </button>
                )
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

        {/* Inline message content */}
        <span style={{ flex: 1, minWidth: 0 }}>
          {showTimestamps && (
            <span className={styles.timestamp}>
              {formatTimestamp(message.timestamp, timestampFormat)}
            </span>
          )}

          {showPlatformBadge && (
            <span
              title={PLATFORM_LABELS[message.platform]}
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                marginRight: '3px',
                position: 'relative',
                top: '-1px',
                color: PLATFORM_DOT_COLORS[message.platform],
                lineHeight: 0
              }}
            >
              <PlatformLogo platform={message.platform} size={11} />
            </span>
          )}

          {pluginAction?.type === 'tag' && (
            <span
              className={styles.pluginTag}
              style={{ background: pluginAction.color ? `${pluginAction.color}22` : undefined, color: pluginAction.color }}
            >
              {pluginAction.label}
            </span>
          )}

          {message.isFirstMessage && (
            <span
              className={styles.pluginTag}
              title="This user's first message ever in this channel"
              style={{ background: 'rgba(80, 200, 120, 0.16)', color: '#50c878' }}
            >
              First message
            </span>
          )}

          {message.sharedSource && (
            message.sharedSource.avatarUrl ? (
              <img
                src={message.sharedSource.avatarUrl}
                alt=""
                title={message.sharedSource.channelName
                  ? `From ${message.sharedSource.channelName}'s chat`
                  : 'From another channel in this Shared Chat'}
                loading="lazy"
                draggable={false}
                style={{
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  marginRight: '4px',
                  outline: '1px solid #a970ff55'
                }}
              />
            ) : (
              <span
                className={styles.pluginTag}
                title={message.sharedSource.channelName
                  ? `From ${message.sharedSource.channelName}'s chat`
                  : 'Sent from another channel in a Twitch Shared Chat session'}
                style={{ background: '#a970ff22', color: '#a970ff' }}
              >
                {message.sharedSource.channelName ? `via ${message.sharedSource.channelName}` : 'shared'}
              </span>
            )
          )}

          {showBadges && <InlineBadges badges={message.badges} />}

          {show7tvBadges && sevenTvCosmetics?.badge && (() => {
            const url = sevenTvBadgeUrl(sevenTvCosmetics.badge)
            return url ? (
              <img
                src={url}
                alt={sevenTvCosmetics.badge.tooltip}
                title={sevenTvCosmetics.badge.tooltip}
                className={styles.badge}
                loading="lazy"
                draggable={false}
              />
            ) : null
          })()}

          {isRedeem && (
            <span className={styles.redeemTag}>
              {message.customRewardId === 'highlighted-message'
                ? '✦ Highlight'
                : `★ ${message.rewardTitle || 'Redeem'}`}
            </span>
          )}

          {clickableUsernames && message.platform === 'twitch' && message.authorName ? (
            <span
              className={styles.authorName}
              style={paintStyle ?? { color: authorColor, cursor: 'pointer' }}
              title={`View ${message.authorName}'s profile`}
              onClick={e => {
                e.stopPropagation()
                window.chatBridge.invoke('usercard:openWindow', {
                  userId: message.authorId,
                  login: message.authorName,
                  channelId: message.channelId
                }).catch(console.error)
              }}
            >
              {displayedName}
            </span>
          ) : (
            <span
              className={styles.authorName}
              style={paintStyle ?? { color: authorColor }}
              title={`${message.authorName} (${message.platform})`}
            >
              {displayedName}
            </span>
          )}

          {(!isRedeem || message.parts.length > 0) && (
            <span className={styles.colon}>: </span>
          )}

          {message.parts.length > 0 && (
            <span className={clsx(styles.messageBody, 'select-text')}>
              <MessageContent parts={message.parts} />
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

export default memo(
  MessageRow,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.isDeleted === next.message.isDeleted &&
    prev.message.isHistorical === next.message.isHistorical &&
    prev.index === next.index
)
