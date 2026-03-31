import { useSettings } from '../../hooks/useSettings'
import Toggle from '../ui/Toggle'
import Slider from '../ui/Slider'
import type { AnimateEmotes } from '@shared/types/settings'

function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string; description?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.description}
          style={{
            flex: 1,
            padding: '5px 4px',
            fontSize: '11px',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            cursor: 'pointer',
            background: value === opt.value ? 'var(--accent)' : 'var(--surface-2)',
            color: value === opt.value ? '#fff' : 'var(--text-secondary)',
            fontWeight: value === opt.value ? 600 : 400,
            transition: 'all 0.1s'
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsEmotes() {
  const { settings, save } = useSettings()
  const { enabledProviders } = settings

  return (
    <div className="space-y-6">

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Emote Providers
        </h3>
        <div className="space-y-3">
          <Toggle
            checked={enabledProviders.sevenTv}
            onCheckedChange={v => save({ enabledProviders: { ...enabledProviders, sevenTv: v } })}
            label="7TV"
          />
          <Toggle
            checked={enabledProviders.bttv}
            onCheckedChange={v => save({ enabledProviders: { ...enabledProviders, bttv: v } })}
            label="BetterTTV (BTTV)"
          />
          <Toggle
            checked={enabledProviders.ffz}
            onCheckedChange={v => save({ enabledProviders: { ...enabledProviders, ffz: v } })}
            label="FrankerFaceZ (FFZ)"
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Emote Size
        </h3>
        <Slider
          label="Emote scale"
          value={settings.emoteScale}
          min={0.75}
          max={3}
          step={0.25}
          onChange={v => save({ emoteScale: v })}
          formatValue={v => `${v}×`}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Scaled relative to the current font size.
        </p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Animation
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          Controls when animated emotes (GIFs) play. "Focused only" pauses them when the window is in the background.
        </p>
        <SegmentedControl<AnimateEmotes>
          options={[
            { value: 'always', label: 'Always', description: 'Always play animated emotes' },
            { value: 'focused', label: 'Focused only', description: 'Animate only when window is focused' },
            { value: 'never', label: 'Never', description: 'Always show static images' }
          ]}
          value={settings.animateEmotes}
          onChange={v => save({ animateEmotes: v })}
        />
      </section>

    </div>
  )
}
