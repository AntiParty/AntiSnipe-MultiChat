import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { useStore } from '../../store'
import { RENDERER_CHANNELS } from '@shared/types/ipc'

export default function StatusBar() {
  const channels = useStore(s => s.channels)
  const connectionStates = useStore(s => s.connectionStates)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)

  const connected = channels.filter(c => connectionStates[c.id]?.status === 'connected').length

  useEffect(() => {
    const unsub1 = window.chatBridge.on(RENDERER_CHANNELS.UPDATE_AVAILABLE, ({ version }) => {
      setUpdateVersion(version)
    })
    const unsub2 = window.chatBridge.on(RENDERER_CHANNELS.UPDATE_DOWNLOADED, ({ version }) => {
      setUpdateVersion(version)
      setDownloaded(true)
    })
    return () => { unsub1(); unsub2() }
  }, [])

  return (
    <div
      className="flex items-center justify-between px-3 h-6 shrink-0 text-xs"
      style={{
        background: 'var(--titlebar-bg)',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)'
      }}
    >
      <span>
        {connected > 0 ? `${connected} connected` : 'No connections'}
      </span>

      {updateVersion && (
        <button
          onClick={() => {
            if (downloaded) {
              // quitAndInstall via IPC — add handler if needed
              console.log('Install update')
            }
          }}
          className="flex items-center gap-1 text-xs hover:text-[var(--text-primary)] transition-colors"
          style={{ color: downloaded ? 'var(--success)' : 'var(--accent)' }}
        >
          <Download size={10} />
          {downloaded ? `v${updateVersion} ready — click to restart` : `v${updateVersion} downloading…`}
        </button>
      )}
    </div>
  )
}
