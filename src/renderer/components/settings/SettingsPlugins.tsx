import { useState, useEffect, useRef, useCallback } from 'react'
import { FolderOpen, RefreshCw, AlertCircle, CheckCircle2, Puzzle, Plus, Save, X, FileCode } from 'lucide-react'
import { highlightJS } from '../../utils/jsHighlight'
import { useSettings } from '../../hooks/useSettings'
import Toggle from '../ui/Toggle'
import type { PluginRecord } from '@shared/types/plugin'

const NEW_PLUGIN_TEMPLATE = `// @name My Plugin
// msg: { author, authorDisplay, text, platform, channelId,
//        messageType, badges, isMod, isSubscriber }
//
// Actions:
//   return { type: 'hide' }
//   return { type: 'highlight', color: 'rgba(255,200,0,0.15)' }
//   return { type: 'tag', label: 'VIP', color: '#a78bfa' }
//   return { type: 'command', respond: 'message to send' }
//   return null

export default function myPlugin(msg) {
  return null
}
`

const EDITOR_FONT = "'Consolas', 'Fira Code', 'Courier New', monospace"
const EDITOR_BG   = '#1e1e1e'
const EDITOR_H    = 300

function CodeEditor({ code, onChange, onSave }: {
  code: string
  onChange: (v: string) => void
  onSave: () => void
}) {
  const taRef  = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const syncScroll = () => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop  = taRef.current.scrollTop
      preRef.current.scrollLeft = taRef.current.scrollLeft
    }
  }

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd+S → save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      e.nativeEvent.stopImmediatePropagation()
      onSave()
      return
    }
    // Tab → 2 spaces; stop Radix Dialog from stealing focus
    if (e.key === 'Tab') {
      e.preventDefault()
      e.nativeEvent.stopImmediatePropagation()
      const el = e.currentTarget
      const start = el.selectionStart
      const end   = el.selectionEnd
      const next  = code.slice(0, start) + '  ' + code.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }, [code, onChange, onSave])

  const shared: React.CSSProperties = {
    fontFamily:  EDITOR_FONT,
    fontSize:    '12px',
    lineHeight:  '1.6',
    padding:     '12px 14px',
    margin:      0,
    whiteSpace:  'pre',
    overflowWrap:'normal',
    tabSize:     2,
  }

  return (
    <div style={{
      position: 'relative',
      height:   EDITOR_H,
      borderRadius: '6px',
      overflow: 'hidden',
      border:   '1px solid #3c3c3c',
      background: EDITOR_BG,
    }}>
      {/* Syntax-highlighted layer */}
      <pre
        ref={preRef}
        aria-hidden
        style={{
          ...shared,
          position:      'absolute',
          inset:         0,
          overflow:      'hidden',
          pointerEvents: 'none',
          color:         '#d4d4d4',
          background:    EDITOR_BG,
        }}
        dangerouslySetInnerHTML={{ __html: highlightJS(code) + '\n' }}
      />
      {/* Editable layer — transparent text, visible caret */}
      <textarea
        ref={taRef}
        value={code}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        spellCheck={false}
        style={{
          ...shared,
          position:   'absolute',
          inset:      0,
          width:      '100%',
          height:     '100%',
          resize:     'none',
          background: 'transparent',
          color:      'transparent',
          caretColor: '#aeafad',
          border:     'none',
          outline:    'none',
          overflow:   'auto',
        }}
      />
    </div>
  )
}

export default function SettingsPlugins() {
  const { settings, save: saveSettings } = useSettings()
  const [plugins,    setPlugins]    = useState<PluginRecord[]>([])
  const [loading,    setLoading]    = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editCode,   setEditCode]   = useState('')
  const [dirty,      setDirty]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const [creating,   setCreating]   = useState(false)
  const [newName,    setNewName]    = useState('')
  const newNameRef  = useRef<HTMLInputElement>(null)
  const savedCodeRef = useRef('')
  const selectedIdRef = useRef(selectedId)
  const dirtyRef      = useRef(dirty)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { dirtyRef.current = dirty },           [dirty])

  useEffect(() => {
    window.chatBridge.invoke('plugins:getAll').then(records => {
      setPlugins(records)
      if (records.length > 0) {
        setSelectedId(records[0].meta.id)
        setEditCode(records[0].code)
        savedCodeRef.current = records[0].code
      }
    })
    const unsub = window.chatBridge.on('plugins:changed', records => {
      setPlugins(records)
      const id = selectedIdRef.current
      if (id && !dirtyRef.current) {
        const up = records.find(p => p.meta.id === id)
        if (up) { setEditCode(up.code); savedCodeRef.current = up.code }
      }
    })
    return unsub
  }, [])

  const selectPlugin = (id: string, code: string) => {
    setSelectedId(id); setEditCode(code)
    savedCodeRef.current = code; setDirty(false); setSaveError(null)
  }

  const handleCodeChange = (v: string) => {
    setEditCode(v); setDirty(v !== savedCodeRef.current); setSaveError(null)
  }

  const save = useCallback(async () => {
    if (!selectedId || !dirty) return
    setSaving(true); setSaveError(null)
    try {
      const updated = await window.chatBridge.invoke('plugins:save', { id: selectedId, code: editCode })
      setPlugins(updated); savedCodeRef.current = editCode; setDirty(false)
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }, [selectedId, dirty, editCode])

  const startCreating = () => {
    setCreating(true); setNewName('')
    requestAnimationFrame(() => newNameRef.current?.focus())
  }

  const confirmCreate = async () => {
    const name = newName.trim(); if (!name) return
    setCreating(false)
    try {
      const updated = await window.chatBridge.invoke('plugins:create', { filename: name, code: NEW_PLUGIN_TEMPLATE })
      setPlugins(updated)
      const safe = name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'my-plugin'
      setSelectedId(safe); setEditCode(NEW_PLUGIN_TEMPLATE)
      savedCodeRef.current = NEW_PLUGIN_TEMPLATE; setDirty(false)
    } catch (err) { console.error('create plugin:', err) }
  }

  const btn = (primary = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '4px 9px', borderRadius: '5px', fontSize: '11px',
    background: primary ? 'var(--accent)' : 'var(--surface-3)',
    border: `1px solid ${primary ? 'transparent' : 'var(--border)'}`,
    color: primary ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0
  })

  const selectedPlugin = plugins.find(p => p.meta.id === selectedId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Plugin Settings */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '12px', color: 'var(--text-primary)' }}>Mention users in responses</p>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>Prefix plugin responses with @username</p>
        </div>
        <Toggle
          checked={settings.pluginMentionUsers}
          onCheckedChange={checked => saveSettings({ pluginMentionUsers: checked })}
        />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button onClick={() => window.chatBridge.invoke('plugins:openFolder')} style={btn()}>
          <FolderOpen size={11} /> Open Folder
        </button>
        <button onClick={startCreating} style={btn()}>
          <Plus size={11} /> New Plugin
        </button>
        <button onClick={async () => {
          setLoading(true)
          try { const r = await window.chatBridge.invoke('plugins:reload'); setPlugins(r) }
          finally { setLoading(false) }
        }} disabled={loading} style={{ ...btn(), opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={11} className={loading ? 'animate-spin' : undefined} /> Reload
        </button>
      </div>

      {/* New plugin name input */}
      {creating && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            ref={newNameRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmCreate(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="filename (without .js)"
            style={{
              flex: 1, padding: '4px 8px', borderRadius: '5px', fontSize: '11px',
              background: 'var(--surface-0)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', outline: 'none'
            }}
          />
          <button onClick={confirmCreate} style={btn(true)}>Create</button>
          <button onClick={() => setCreating(false)} style={btn()}><X size={11} /></button>
        </div>
      )}

      {plugins.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '8px', padding: '24px', borderRadius: '8px',
          border: '1px dashed var(--border)', color: 'var(--text-muted)',
          fontSize: '11px', textAlign: 'center'
        }}>
          <Puzzle size={20} style={{ opacity: 0.4 }} />
          <div>No plugins yet.</div>
          <div style={{ opacity: 0.7 }}>Click <strong>New Plugin</strong> or drop <code>.js</code> files into the plugins folder.</div>
        </div>
      ) : (
        <>
          {/* Plugin list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {plugins.map(p => {
              const sel = p.meta.id === selectedId
              return (
                <div key={p.meta.id} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 10px', borderRadius: '6px',
                  background: sel ? 'var(--surface-3)' : 'var(--surface-2)',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                  {/* Enable/disable toggle */}
                  <button
                    title={p.meta.enabled ? 'Disable plugin' : 'Enable plugin'}
                    onClick={async e => {
                      e.stopPropagation()
                      const updated = await window.chatBridge.invoke('plugins:toggle', { id: p.meta.id, enabled: !p.meta.enabled })
                      setPlugins(updated)
                    }}
                    style={{
                      flexShrink: 0, width: '28px', height: '16px', borderRadius: '8px',
                      border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
                      background: p.meta.enabled ? 'var(--accent)' : 'var(--surface-0)',
                      transition: 'background 0.15s',
                      outline: '1px solid var(--border)'
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: '2px',
                      left: p.meta.enabled ? '14px' : '2px',
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: '#fff', transition: 'left 0.15s', display: 'block'
                    }} />
                  </button>

                  {/* Name / status — clickable to select */}
                  <button onClick={() => selectPlugin(p.meta.id, p.code)} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    flex: 1, minWidth: 0, textAlign: 'left',
                    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0
                  }}>
                    <span style={{ flexShrink: 0 }}>
                      {p.meta.error
                        ? <AlertCircle size={12} style={{ color: 'var(--danger)' }} />
                        : <CheckCircle2 size={12} style={{ color: p.meta.enabled ? '#4caf50' : 'var(--text-muted)' }} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: '12px', fontWeight: 600,
                        color: p.meta.enabled ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}>{p.meta.name}</span>
                      {sel && dirty && <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '6px' }}>● unsaved</span>}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{p.meta.id}.js</span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Editor */}
          {selectedPlugin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCode size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>{selectedPlugin.meta.id}.js</span>
                <button onClick={save} disabled={!dirty || saving} style={{
                  ...btn(dirty),
                  opacity: (!dirty || saving) ? 0.4 : 1,
                  cursor:  (!dirty || saving) ? 'default' : 'pointer'
                }}>
                  <Save size={11} />{saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              <CodeEditor code={editCode} onChange={handleCodeChange} onSave={save} />

              {(saveError || selectedPlugin.meta.error) ? (
                <div style={{ fontSize: '10px', color: 'var(--danger)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {saveError ?? selectedPlugin.meta.error}
                </div>
              ) : (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Ctrl+S to save · Tab inserts 2 spaces · Files hot-reload on save
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
