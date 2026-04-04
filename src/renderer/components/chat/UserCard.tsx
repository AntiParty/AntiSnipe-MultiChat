import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, Shield, Ban, ExternalLink, GripHorizontal } from 'lucide-react'
import { useStore } from '../../store'
import type { UserCardData } from '@shared/types/ipc'
import type { NormalizedMessage } from '@shared/types/message'

const EMPTY_MSGS: NormalizedMessage[] = []

interface UserCardProps {
  userId: string
  login: string
  channelId: string
  anchorRect: DOMRect
  onClose: () => void
  onModAction: (action: 'timeout' | 'ban' | 'unban', userId: string, login: string) => void
}

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

function subTierLabel(tier: string) {
  if (tier === '2000') return 'Tier 2'
  if (tier === '3000') return 'Tier 3'
  return 'Tier 1'
}

const CARD_W = 260

export default function UserCard({ userId, login, channelId, anchorRect, onClose, onModAction }: UserCardProps) {
  const [data, setData] = useState<UserCardData | null | 'loading'>('loading')
  const cardRef = useRef<HTMLDivElement>(null)
  const isMod = useStore(s => s.selfModByChannel[channelId])

  // Messages from this user in this channel
  const channelMessages = useStore(s => s.messagesByChannel[channelId] ?? EMPTY_MSGS)
  const recentMessages = useMemo(() => {
    const filtered = channelMessages.filter(m => m.authorName === login && !m.isDeleted)
    return filtered.slice(-30).reverse()
  }, [channelMessages, login])

  // Drag state — initial position anchored below the username
  const vw = window.innerWidth
  const vh = window.innerHeight
  const initLeft = Math.min(Math.max(anchorRect.left, 8), vw - CARD_W - 8)
  const initTop = anchorRect.bottom + 4 + 220 > vh - 8
    ? Math.max(anchorRect.top - 4 - 400, 8)
    : anchorRect.bottom + 4

  const [pos, setPos] = useState({ x: initLeft, y: initTop })
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, img, input')) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y }
  }, [pos])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPos({
        x: Math.max(0, Math.min(vw - CARD_W, dragRef.current.startPosX + dx)),
        y: Math.max(0, dragRef.current.startPosY + dy)
      })
    }
    const onUp = () => { dragRef.current = null }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [vw])

  useEffect(() => {
    window.chatBridge.invoke('twitch:getUserCard', { userId, channelId, login })
      .then(d => setData(d))
      .catch(() => setData(null))
  }, [userId, channelId, login])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const card = (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        top: pos.y,
        left: pos.x,
        width: CARD_W,
        zIndex: 9999,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        fontSize: '12px',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh'
      }}
    >
      {/* Drag handle / title bar */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '5px 8px 5px 10px',
          background: 'var(--surface-3)',
          borderBottom: '1px solid var(--border)',
          cursor: 'grab',
          userSelect: 'none',
          flexShrink: 0
        }}
      >
        <GripHorizontal size={11} style={{ color: 'var(--text-muted)', marginRight: 5 }} />
        <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {login}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
        >
          <X size={11} />
        </button>
      </div>

      {data === 'loading' ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
          Loading…
        </div>
      ) : data === null ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
          Could not load user info
        </div>
      ) : (
        <>
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', flexShrink: 0 }}>
            <img
              src={data.profileImageUrl}
              alt={data.displayName}
              onClick={() => window.chatBridge.invoke('shell:openExternal', { url: `https://twitch.tv/${data.login}` })}
              style={{
                width: 42, height: 42, borderRadius: '50%', cursor: 'pointer',
                flexShrink: 0, border: '2px solid var(--border)', objectFit: 'cover'
              }}
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
                onClick={() => window.chatBridge.invoke('shell:openExternal', { url: `https://twitch.tv/${data.login}` })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2,
                  background: 'none', border: 'none', color: '#9147ff',
                  cursor: 'pointer', padding: 0, fontSize: '10px'
                }}
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
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 60, maxHeight: 200 }}>
            {recentMessages.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>No messages in view</div>
            ) : (
              recentMessages.map(msg => (
                <div key={msg.id} style={{ padding: '3px 10px', borderBottom: '1px solid var(--border)', fontSize: '11px', lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', marginRight: 5 }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{msg.raw}</span>
                </div>
              ))
            )}
          </div>

          {/* Mod actions */}
          {isMod && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '7px 12px', display: 'flex', gap: 5, flexShrink: 0 }}>
              <button
                onClick={() => { onModAction('timeout', data.userId, data.login); onClose() }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  padding: '5px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--surface-3)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px'
                }}
              >
                <Clock size={10} /> Timeout
              </button>
              <button
                onClick={() => { onModAction('ban', data.userId, data.login); onClose() }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  padding: '5px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--surface-3)', color: 'var(--danger)', cursor: 'pointer', fontSize: '10px'
                }}
              >
                <Ban size={10} /> Ban
              </button>
              <button
                onClick={() => { onModAction('unban', data.userId, data.login); onClose() }}
                title="Unban"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, padding: '5px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--surface-3)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px'
                }}
              >
                <Shield size={10} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )

  return createPortal(card, document.body)
}
