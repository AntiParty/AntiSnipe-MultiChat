import { useState, useEffect } from 'react'
import { Settings, Minus, Square, X } from 'lucide-react'
import { useStore } from '../../store'
import Tooltip from '../ui/Tooltip'

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
      className="flex items-center h-9 shrink-0 select-none"
      style={{
        background: 'var(--titlebar-bg)',
        borderBottom: '1px solid var(--border)',
        WebkitAppRegion: 'drag'
      } as React.CSSProperties}
    >
      {/* App name / logo */}
      <div className="px-3 flex items-center gap-2">
        <span
          className="text-xs font-semibold tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          AntiSnipe MultiChat
        </span>
      </div>

      {/* Drag region fills remaining space */}
      <div className="flex-1" />

      {/* Non-draggable controls */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Tooltip content="Settings">
          <button
            onClick={openSettings}
            className="flex items-center justify-center w-9 h-9 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Settings"
          >
            <Settings size={14} />
          </button>
        </Tooltip>

        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-9 h-9 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
          aria-label="Minimize"
        >
          <Minus size={13} />
        </button>

        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-9 h-9 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          <Square size={11} />
        </button>

        <button
          onClick={handleClose}
          className="flex items-center justify-center w-9 h-9 text-[var(--text-secondary)] hover:text-white hover:bg-red-600 transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
