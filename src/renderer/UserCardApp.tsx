/**
 * UserCardApp — root component rendered when the app is launched in
 * "usercard" mode (i.e. ?mode=usercard in the URL).
 *
 * This is a self-contained floating window; all data comes through IPC.
 * The window itself handles positioning and OS-native dragging via the
 * `-webkit-app-region: drag` title bar — no custom JS drag needed.
 */
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { X, Clock, Shield, Ban, ExternalLink } from 'lucide-react'
import type { UserCardData } from '@shared/types/ipc'
import type { NormalizedMessage } from '@shared/types/message'

const params = new URLSearchParams(window.location.search)
const USER_ID = params.get('userId') || ''
const LOGIN = params.get('login') || ''
const CHANNEL_ID = params.get('channelId') || ''

function formatFollowDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function followDuration(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

function subTierLabel(tier: string): string {
  if (tier === '2000') return 'Tier 2'
  if (tier === '3000') return 'Tier 3'
  return 'Tier 1'
}

export default function UserCardApp() {
  const [data, setData] = useState<UserCardData | null | 'loading'>('loading')
  const [recentMessages, setRecentMessages] = useState<NormalizedMessage[]>([])
  const [isMod, setIsMod] = useState(false)
  const msgsScrollRef = useRef<HTMLDivElement>(null)

  // Apply theme from settings so the card matches the main window
  useEffect(() => {
    window.chatBridge.invoke('settings:get').then(s => {
      const theme = (s as { theme?: string }).theme ?? 'dark'
      const html = document.documentElement
      html.classList.remove('dark', 'light')
      if (theme === 'system') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        html.classList.add(mq.matches ? 'dark' : 'light')
      } else {
        html.classList.add(theme)
      }
    }).catch(() => {
      document.documentElement.classList.add('dark')
    })
  }, [])

  useEffect(() => {
    // Fetch user card info
    window.chatBridge.invoke('twitch:getUserCard', { userId: USER_ID, channelId: CHANNEL_ID, login: LOGIN })
      .then(d => setData(d as UserCardData | null))
      .catch(() => setData(null))

    // Fetch recent messages for this user from the main process history.
    // (chat:getRecentMessages is consume-on-read and already drained by the
    // main window at startup — it always returned [] here.)
    window.chatBridge.invoke('chat:getUserMessages', { channelId: CHANNEL_ID, login: LOGIN })
      .then(msgs => setRecentMessages(msgs as NormalizedMessage[]))
      .catch(() => {})

    // Mod status
    window.chatBridge.invoke('mod:getSelfStatuses')
      .then(statuses => {
        const s = statuses as Record<string, boolean>
        setIsMod(s[CHANNEL_ID] ?? false)
      })
      .catch(() => {})
  }, [])

  // Scroll messages to bottom (newest last)
  useLayoutEffect(() => {
    if (msgsScrollRef.current) {
      msgsScrollRef.current.scrollTop = msgsScrollRef.current.scrollHeight
    }
  }, [recentMessages.length])

  const close = (): void => {
    window.chatBridge.invoke('window:close')
  }

  const modAction = async (action: 'timeout' | 'ban' | 'unban'): Promise<void> => {
    if (!data || data === 'loading') return
    try {
      await window.chatBridge.invoke('mod:action', {
        channelId: CHANNEL_ID,
        action,
        targetUserId: data.userId,
        targetUserLogin: data.login,
        duration: action === 'timeout' ? 600 : undefined
      })
    } catch (err) {
      console.error('Mod action failed:', err)
    }
    close()
  }

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
      fontSize: '12px',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none'
    }}>
      {/* Title bar — -webkit-app-region: drag makes OS handle dragging */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 8px 5px 10px',
        background: 'var(--surface-3)',
        borderBottom: '1px solid var(--border)',
        WebkitAppRegion: 'drag',
        flexShrink: 0
      } as React.CSSProperties}>
        <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {LOGIN}
        </span>
        {/* Buttons must opt out of the drag region */}
        <button
          onClick={close}
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 2, display: 'flex'
          } as React.CSSProperties}
        >
          <X size={11} />
        </button>
      </div>

      {data === 'loading' ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      ) : data === null ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          Could not load user info
        </div>
      ) : (
        <>
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', flexShrink: 0 }}>
            <img
              src={data.profileImageUrl}
              alt={data.displayName}
              onClick={() => window.chatBridge.invoke('shell:openExternal', { url: `https://twitch.tv/${data!.login}` })}
              style={{
                width: 42, height: 42, borderRadius: '50%', cursor: 'pointer',
                flexShrink: 0, border: '2px solid var(--border)', objectFit: 'cover',
                WebkitAppRegion: 'no-drag'
              } as React.CSSProperties}
              title="Open Twitch profile"
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.displayName}
              </div>
              {data.displayName.toLowerCase() !== data.login && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{data.login}</div>
              )}
              <button
                onClick={() => window.chatBridge.invoke('shell:openExternal', { url: `https://twitch.tv/${data!.login}` })}
                style={{
                  WebkitAppRegion: 'no-drag',
                  display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2,
                  background: 'none', border: 'none', color: '#9147ff',
                  cursor: 'pointer', padding: 0, fontSize: '10px'
                } as React.CSSProperties}
              >
                <ExternalLink size={9} /> View channel
              </button>
            </div>
          </div>

          {/* Follow / sub info */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '7px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.followedAt ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ color: '#4caf50', marginTop: 1 }}>♥</span>
                <div>
                  <div>Following since {formatFollowDate(data.followedAt)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{followDuration(data.followedAt)}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Not following</div>
            )}
            {data.subTier && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#9147ff', fontSize: '11px' }}>
                <span>★</span>
                <span>{subTierLabel(data.subTier)} subscriber{data.subMonths ? ` · ${data.subMonths}mo` : ''}</span>
              </div>
            )}
          </div>

          {/* Recent messages */}
          <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ padding: '4px 10px 3px', fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Recent messages ({recentMessages.length})
            </div>
          </div>
          <div ref={msgsScrollRef} style={{ overflowY: 'auto', flex: 1, minHeight: 60 }}>
            {recentMessages.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>No messages in view</div>
            ) : (
              recentMessages.map(msg => (
                <div key={msg.id} style={{ padding: '3px 10px', borderBottom: '1px solid var(--border)', fontSize: '11px', lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', marginRight: 5 }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: 'var(--text-primary)', userSelect: 'text' }}>{msg.raw}</span>
                </div>
              ))
            )}
          </div>

          {/* Mod actions */}
          {isMod && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '7px 12px', display: 'flex', gap: 5, flexShrink: 0 }}>
              <button
                onClick={() => modAction('timeout')}
                style={{
                  WebkitAppRegion: 'no-drag',
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  padding: '5px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--surface-3)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px'
                } as React.CSSProperties}
              >
                <Clock size={10} /> Timeout
              </button>
              <button
                onClick={() => modAction('ban')}
                style={{
                  WebkitAppRegion: 'no-drag',
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  padding: '5px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--surface-3)', color: 'var(--danger)', cursor: 'pointer', fontSize: '10px'
                } as React.CSSProperties}
              >
                <Ban size={10} /> Ban
              </button>
              <button
                onClick={() => modAction('unban')}
                title="Unban"
                style={{
                  WebkitAppRegion: 'no-drag',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, padding: '5px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--surface-3)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px'
                } as React.CSSProperties}
              >
                <Shield size={10} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
