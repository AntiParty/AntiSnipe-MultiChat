import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { X } from 'lucide-react'
import { useStore } from '../../store'
import SettingsGeneral from './SettingsGeneral'
import SettingsEmotes from './SettingsEmotes'
import SettingsFilters from './SettingsFilters'
import SettingsAuth from './SettingsAuth'
import SettingsMod from './SettingsMod'

const TABS = [
  { id: 'general', label: 'General', Component: SettingsGeneral },
  { id: 'emotes', label: 'Emotes', Component: SettingsEmotes },
  { id: 'filters', label: 'Filters', Component: SettingsFilters },
  { id: 'moderation', label: 'Moderation', Component: SettingsMod },
  { id: 'auth', label: 'Auth', Component: SettingsAuth }
]

export default function SettingsModal() {
  const open = useStore(s => s.settingsOpen)
  const closeSettings = useStore(s => s.closeSettings)

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) closeSettings() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40 animate-in fade-in-0"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-h-[80vh] flex flex-col rounded-xl shadow-2xl animate-in fade-in-0 zoom-in-95"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded transition-colors hover:bg-[var(--surface-3)]"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close settings"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Tabs */}
          <Tabs.Root defaultValue="general" className="flex flex-col flex-1 min-h-0">
            <Tabs.List
              className="flex px-5 pt-3 gap-1 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {TABS.map(tab => (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  className="px-3 py-1.5 text-xs rounded-t transition-colors data-[state=active]:text-[var(--text-primary)] data-[state=inactive]:text-[var(--text-secondary)]"
                  style={{}}
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {TABS.map(({ id, Component }) => (
              <Tabs.Content
                key={id}
                value={id}
                className="flex-1 overflow-y-auto p-5"
              >
                <Component />
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
