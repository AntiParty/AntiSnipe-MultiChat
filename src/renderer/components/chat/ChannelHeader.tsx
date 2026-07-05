import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import type { ChannelConfig } from '@shared/types/channel'

function openExternal(url: string) {
  window.chatBridge.invoke('shell:openExternal', { url }).catch(() => {})
}

/** Per-platform browser links for the header context menu. */
function channelLinks(channel: ChannelConfig): Array<{ label: string; url: string }> {
  const { platform, slug } = channel
  if (platform === 'twitch') {
    return [
      { label: 'Open Stream in Browser', url: `https://www.twitch.tv/${slug}` },
      { label: 'Open Chat Popout', url: `https://www.twitch.tv/popout/${slug}/chat` },
      { label: 'Open Mod View', url: `https://www.twitch.tv/moderator/${slug}` }
    ]
  }
  if (platform === 'youtube') {
    // slug may be a handle, a full URL, or an 11-char video ID
    const streamUrl = slug.startsWith('http')
      ? slug
      : /^[A-Za-z0-9_-]{11}$/.test(slug)
        ? `https://www.youtube.com/watch?v=${slug}`
        : `https://www.youtube.com/@${slug.replace(/^@/, '')}/live`
    return [
      { label: 'Open Stream in Browser', url: streamUrl },
      { label: 'Open YouTube Studio (mod tools)', url: 'https://studio.youtube.com' }
    ]
  }
  if (platform === 'kick') {
    return [{ label: 'Open Stream in Browser', url: `https://kick.com/${slug}` }]
  }
  if (platform === 'tiktok') {
    return [{ label: 'Open Live in Browser', url: `https://www.tiktok.com/@${slug.replace(/^@/, '')}/live` }]
  }
  return []
}

/** "1h 13m" style uptime from an ISO start timestamp. */
function formatUptime(startedAt: string, now: number): string | null {
  const start = Date.parse(startedAt)
  if (!Number.isFinite(start) || start > now) return null
  const mins = Math.floor((now - start) / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function ChannelHeader() {
  const activeChannelId = useStore(s => s.activeChannelId)
  const channels = useStore(s => s.channels)
  const viewerCounts = useStore(s => s.viewerCountsByChannel)
  const streamInfo = useStore(s => s.streamInfoByChannel)
  const connectionStates = useStore(s => s.connectionStates)
  const clearChannel = useStore(s => s.clearChannel)
  const viewerListOpen = useStore(s => s.viewerListOpen)
  const toggleViewerList = useStore(s => s.toggleViewerList)

  // Tick every 30s so the uptime counter stays fresh between polls
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  const handleLiveContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const handleClearChat = () => {
    if (activeChannelId && activeChannelId !== 'all') clearChannel(activeChannelId)
    else channels.forEach(c => clearChannel(c.id))
    setMenu(null)
  }

  if (activeChannelId === 'all') {
    const total = Object.values(viewerCounts).reduce((s, n) => s + n, 0)
    return (
      <>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '3px 10px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          minHeight: '22px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>All Channels</span>
          {total > 0 && (
            <span
              onContextMenu={handleLiveContextMenu}
              style={{ marginLeft: 8, fontSize: '10px', color: 'var(--text-muted)', cursor: 'context-menu', userSelect: 'none' }}
            >
              {total.toLocaleString()} viewers
            </span>
          )}
        </div>
        {menu && (
          <div ref={menuRef} style={{
            position: 'fixed', top: menu.y, left: menu.x, zIndex: 200,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '5px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            overflow: 'hidden', minWidth: '130px'
          }}>
            <button
              onClick={handleClearChat}
              style={{ display: 'block', width: '100%', padding: '7px 12px', background: 'none', border: 'none', textAlign: 'left', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              Clear All Chats
            </button>
          </div>
        )}
      </>
    )
  }

  const channel = channels.find(c => c.id === activeChannelId)
  if (!channel) return null

  const viewers = viewerCounts[activeChannelId]
  const info = streamInfo[activeChannelId]
  const state = connectionStates[activeChannelId]
  const isLive = state?.status === 'connected' && viewers != null && viewers > 0
  const uptime = info?.startedAt ? formatUptime(info.startedAt, now) : null

  // Chatterino-style status line: name (live) - 1h 13m - 126 - VALORANT
  const statusParts = isLive
    ? [uptime, viewers!.toLocaleString(), info?.gameName || null].filter(Boolean)
    : []

  return (
    <>
      <div
        onContextMenu={handleLiveContextMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3px 10px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          minHeight: '22px',
          gap: '6px',
          position: 'relative'
        }}
      >
        <span
          title={isLive ? (info?.title || undefined) : undefined}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: isLive ? 'var(--accent)' : 'var(--text-primary)',
            cursor: 'context-menu',
            userSelect: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {channel.displayName}
          {isLive && <span style={{ fontWeight: 400 }}> (live)</span>}
          {statusParts.length > 0 && (
            <span style={{ fontWeight: 400 }}>
              {statusParts.map(p => ` - ${p}`).join('')}
            </span>
          )}
        </span>
        <div style={{ position: 'absolute', right: '4px', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={toggleViewerList}
          title={viewerListOpen ? 'Hide viewer list' : 'Show viewer list'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: viewerListOpen ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '0 2px',
            fontSize: '13px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center'
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = viewerListOpen ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          ☰
        </button>
        </div>
      </div>

      {menu && (
        <div ref={menuRef} style={{
          position: 'fixed', top: menu.y, left: menu.x, zIndex: 200,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '5px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          overflow: 'hidden', minWidth: '170px'
        }}>
          {channelLinks(channel).map(item => (
            <button
              key={item.url}
              onClick={() => { openExternal(item.url); setMenu(null) }}
              style={{ display: 'block', width: '100%', padding: '7px 12px', background: 'none', border: 'none', textAlign: 'left', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={handleClearChat}
            style={{ display: 'block', width: '100%', padding: '7px 12px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', textAlign: 'left', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          >
            Clear Chat
          </button>
        </div>
      )}
    </>
  )
}
