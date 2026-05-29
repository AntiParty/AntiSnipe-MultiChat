import { useState, useEffect } from 'react'
import { Settings, Minus, Square, X } from 'lucide-react'
import { useStore } from '../../store'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const openSettings = useStore(s => s.openSettings)

  useEffect(() => {
    window.chatBridge.invoke('window:isMaximized').then(setIsMaximized)
  }, [])

  const handleMinimize = () => window.chatBridge.invoke('window:minimize')
  const handleMaximize = async () => {
    await window.chatBridge.invoke('window:maximize')
    const max = await window.chatBridge.invoke('window:isMaximized')
    setIsMaximized(max)
  }
  const handleClose = () => window.chatBridge.invoke('window:close')

  return (
    <div
      className="titleBar"
      style={{
        WebkitAppRegion: 'drag'
      } as React.CSSProperties}
    >
      <span
        className="titleBarBrand"
      >
        Confluence
      </span>

      <div className="titleBarSpacer" />

      {/* Window controls — no-drag zone */}
      <div
        className="titleBarControls"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <TitleBtn onClick={openSettings} label="Settings">
          <Settings size={12} />
        </TitleBtn>
        <TitleBtn onClick={handleMinimize} label="Minimize">
          <Minus size={12} />
        </TitleBtn>
        <TitleBtn onClick={handleMaximize} label={isMaximized ? 'Restore' : 'Maximize'}>
          <Square size={10} />
        </TitleBtn>
        <TitleBtn onClick={handleClose} label="Close" danger>
          <X size={12} />
        </TitleBtn>
      </div>
    </div>
  )
}

function TitleBtn({
  onClick,
  label,
  danger,
  children
}: {
  onClick: () => void
  label: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="titleBarButton"
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.background = danger
          ? '#c42b2b'
          : 'var(--surface-3)'
        ;(e.currentTarget as HTMLButtonElement).style.color = danger
          ? '#ffffff'
          : 'var(--text-primary)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
      }}
    >
      {children}
    </button>
  )
}
