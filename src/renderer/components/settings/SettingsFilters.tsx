import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import Input from '../ui/Input'
import Button from '../ui/Button'

function KeywordList({
  title,
  description,
  keywords,
  onAdd,
  onRemove
}: {
  title: string
  description: string
  keywords: string[]
  onAdd: (k: string) => void
  onRemove: (k: string) => void
}) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    const trimmed = input.trim()
    if (trimmed && !keywords.includes(trimmed)) {
      onAdd(trimmed)
      setInput('')
    }
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h3>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{description}</p>

      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add keyword…"
          className="flex-1 text-xs px-2 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        <Button size="sm" variant="primary" onClick={handleAdd} disabled={!input.trim()}>
          <Plus size={12} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {keywords.map(kw => (
          <span
            key={kw}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
          >
            {kw}
            <button onClick={() => onRemove(kw)} className="hover:text-[var(--danger)] transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>None</span>
        )}
      </div>
    </div>
  )
}

export default function SettingsFilters() {
  const { settings, save } = useSettings()

  return (
    <div className="space-y-8">
      <KeywordList
        title="Mention Keywords"
        description="Messages containing these words will be highlighted as mentions."
        keywords={settings.mentionKeywords}
        onAdd={k => save({ mentionKeywords: [...settings.mentionKeywords, k] })}
        onRemove={k => save({ mentionKeywords: settings.mentionKeywords.filter(x => x !== k) })}
      />
      <KeywordList
        title="Alert Keywords"
        description="Messages containing these words will be highlighted with a distinct accent color."
        keywords={settings.keywordAlerts}
        onAdd={k => save({ keywordAlerts: [...settings.keywordAlerts, k] })}
        onRemove={k => save({ keywordAlerts: settings.keywordAlerts.filter(x => x !== k) })}
      />
    </div>
  )
}
