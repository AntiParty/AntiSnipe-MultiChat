import { useRef, useCallback } from 'react'
import { useStore } from '../../store'
import ViewerList from './ViewerList'

interface Props {
  channelId: string
}

export default function ViewerListPanel({ channelId }: Props) {
  const width = useStore(s => s.settings.viewerListWidth || 180)
  const closeViewerList = useStore(s => s.closeViewerList)
  const updateSettings = useStore(s => s.updateSettings)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelRef.current?.offsetWidth ?? width

    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(140, Math.min(320, startWidth + (startX - ev.clientX)))
      if (panelRef.current) panelRef.current.style.width = `${newWidth}px`
    }

    const onUp = (ev: MouseEvent) => {
      const newWidth = Math.max(140, Math.min(320, startWidth + (startX - ev.clientX)))
      updateSettings({ viewerListWidth: newWidth })
      window.chatBridge.invoke('settings:set', { viewerListWidth: newWidth }).catch(() => {})
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width, updateSettings])

  return (
    <div
      ref={panelRef}
      style={{
        width: `${width}px`,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--surface-1)'
      }}
    >
      {/* Resize handle on the left edge */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'ew-resize',
          zIndex: 1
        }}
      />

      {/* Header bar with close button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '2px 4px 2px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        minHeight: '22px'
      }}>
        <button
          onClick={closeViewerList}
          title="Close viewer list"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '1px 4px',
            fontSize: '14px',
            lineHeight: 1,
            borderRadius: '3px'
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          ✕
        </button>
      </div>

      <ViewerList channelId={channelId} />
    </div>
  )
}
