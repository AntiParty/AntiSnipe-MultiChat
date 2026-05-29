import { useEffect, useRef } from 'react'
import { useStore } from './store'
import { initIpcSync } from './store/middleware/ipcSync'
import TitleBar from './components/layout/TitleBar'
import StatusBar from './components/layout/StatusBar'
import ChatPane from './components/chat/ChatPane'
import ChatTabs from './components/chat/ChatTabs'
import ChannelHeader from './components/chat/ChannelHeader'
import SettingsModal from './components/settings/SettingsModal'
import UpdateBanner from './components/layout/UpdateBanner'
import ViewerListPanel from './components/viewer/ViewerListPanel'

export default function App() {
  const activeChannelId = useStore(s => s.activeChannelId)
  const viewerListOpen = useStore(s => s.viewerListOpen)
  const theme = useStore(s => s.settings.theme)
  const fontSize = useStore(s => s.settings.fontSize)
  const emoteScale = useStore(s => s.settings.emoteScale)
  const updateSettings = useStore(s => s.updateSettings)
  const openSettings = useStore(s => s.openSettings)
  const closeSettings = useStore(s => s.closeSettings)
  const setWindowFocused = useStore(s => s.setWindowFocused)

  // Keep latest fontSize in a ref for keyboard handler closure
  const fontSizeRef = useRef(fontSize)
  useEffect(() => { fontSizeRef.current = fontSize }, [fontSize])

  // Boot IPC sync
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
  }, [fontSize])

  useEffect(() => {
    document.documentElement.style.setProperty('--emote-scale', String(emoteScale))
  }, [emoteScale])

  // Track window focus for animated emote control
  useEffect(() => {
    const onFocus = () => setWindowFocused(true)
    const onBlur = () => setWindowFocused(false)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [setWindowFocused])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl) {
        // Ctrl/Cmd + = or + → zoom in
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          const next = Math.min(fontSizeRef.current + 1, 22)
          updateSettings({ fontSize: next })
          window.chatBridge.invoke('settings:set', { fontSize: next })
          return
        }
        // Ctrl/Cmd + - → zoom out
        if (e.key === '-') {
          e.preventDefault()
          const next = Math.max(fontSizeRef.current - 1, 10)
          updateSettings({ fontSize: next })
          window.chatBridge.invoke('settings:set', { fontSize: next })
          return
        }
        // Ctrl/Cmd + 0 → reset zoom
        if (e.key === '0') {
          e.preventDefault()
          updateSettings({ fontSize: 14 })
          window.chatBridge.invoke('settings:set', { fontSize: 14 })
          return
        }
        // Ctrl/Cmd + , → open settings (Chatterino convention)
        if (e.key === ',') {
          e.preventDefault()
          openSettings()
          return
        }
      }

      // Escape → close settings / close panels
      if (e.key === 'Escape') {
        closeSettings()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [updateSettings, openSettings, closeSettings])

  return (
    <div className="appShell">
      <TitleBar />
      <UpdateBanner />
      <ChatTabs />
      <ChannelHeader />
      <main className="chatWorkspace" aria-label="Chat workspace">
        <section className="chatSplitGrid" aria-label="Chat pane group">
          <div className="chatSplitPane chatSplitPaneActive" data-pane-id={activeChannelId}>
            <ChatPane key={activeChannelId} />
          </div>
        </section>
        {viewerListOpen && activeChannelId !== 'all' && (
          <ViewerListPanel channelId={activeChannelId} />
        )}
      </main>
      <StatusBar />
      <SettingsModal />
    </div>
  )
}
