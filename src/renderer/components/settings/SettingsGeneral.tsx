import { useSettings } from '../../hooks/useSettings'
import Toggle from '../ui/Toggle'
import Slider from '../ui/Slider'
import type { Theme } from '@shared/types/settings'

export default function SettingsGeneral() {
  const { settings, save } = useSettings()

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Appearance
        </h3>
        <div className="space-y-4">
          {/* Theme */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
              Theme
            </label>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as Theme[]).map(t => (
                <button
                  key={t}
                  onClick={() => save({ theme: t })}
                  className="flex-1 py-1.5 text-xs rounded-md border transition-colors capitalize"
                  style={{
                    background: settings.theme === t ? 'var(--accent)' : 'var(--surface-2)',
                    color: settings.theme === t ? 'white' : 'var(--text-secondary)',
                    borderColor: settings.theme === t ? 'var(--accent)' : 'var(--border)'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <Slider
            label="Font Size"
            value={settings.fontSize}
            min={10}
            max={22}
            step={1}
            onChange={v => save({ fontSize: v })}
            formatValue={v => `${v}px`}
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Chat Display
        </h3>
        <div className="space-y-3">
          <Toggle
            checked={settings.showTimestamps}
            onCheckedChange={v => save({ showTimestamps: v })}
            label="Show timestamps"
          />
          <Toggle
            checked={settings.showBadges}
            onCheckedChange={v => save({ showBadges: v })}
            label="Show badges"
          />
          <Toggle
            checked={settings.showPlatformBadge}
            onCheckedChange={v => save({ showPlatformBadge: v })}
            label="Show platform indicator"
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Performance
        </h3>
        <Slider
          label="Max messages per channel"
          value={settings.maxMessagesPerChannel}
          min={500}
          max={10000}
          step={500}
          onChange={v => save({ maxMessagesPerChannel: v })}
          formatValue={v => v.toLocaleString()}
        />
      </section>
    </div>
  )
}
