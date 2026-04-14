import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'

export default function ChannelHeader() {
  const activeChannelId = useStore(s => s.activeChannelId)
  const channels = useStore(s => s.channels)
  const viewerCounts = useStore(s => s.viewerCountsByChannel)
  const connectionStates = useStore(s => s.connectionStates)
  const clearChannel = useStore(s => s.clearChannel)
  const viewerListOpen = useStore(s => s.viewerListOpen)
  const toggleViewerList = useStore(s => s.toggleViewerList)

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
  const state = connectionStates[activeChannelId]
  const isLive = state?.status === 'connected' && viewers != null && viewers > 0

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 10px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        minHeight: '22px',
        gap: '6px'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {channel.displayName}
        </span>
        {isLive && (
          <span
            onContextMenu={handleLiveContextMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'context-menu', userSelect: 'none' }}
            title="Right-click to clear chat"
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e91916', flexShrink: 0 }} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {viewers!.toLocaleString()} viewers
            </span>
          </span>
        )}
        <div style={{ flex: 1 }} />
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
            Clear Chat
          </button>
        </div>
      )}
    </>
  )
}
