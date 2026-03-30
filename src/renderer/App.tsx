import { useEffect } from 'react'
import { useStore } from './store'
import { initIpcSync } from './store/middleware/ipcSync'
import TitleBar from './components/layout/TitleBar'
import Sidebar from './components/layout/Sidebar'
import StatusBar from './components/layout/StatusBar'
import ChatPane from './components/chat/ChatPane'
import ChatTabs from './components/chat/ChatTabs'
import SettingsModal from './components/settings/SettingsModal'

export default function App() {
  const theme = useStore(s => s.settings.theme)
  const fontSize = useStore(s => s.settings.fontSize)
  const emoteScale = useStore(s => s.settings.emoteScale)

  // Boot IPC sync (subscribes to main-process push events)
  useEffect(() => {
    const cleanup = initIpcSync()
    return cleanup
  }, [])

  // Apply theme class to <html>
  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      html.classList.add(mq.matches ? 'dark' : 'light')
    } else {
      html.classList.add(theme)
    }
  }, [theme])

  // Apply font size and emote scale as CSS vars
  useEffect(() => {
    document.documentElement.style.setProperty('--font-size', `${fontSize}px`)
    document.documentElement.style.setProperty('--emote-scale', String(emoteScale))
  }, [fontSize, emoteScale])

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--surface-0)', color: 'var(--text-primary)' }}
    >
      <TitleBar />

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <ChatTabs />
          <ChatPane />
        </main>
      </div>

      <StatusBar />
      <SettingsModal />
    </div>
  )
}
