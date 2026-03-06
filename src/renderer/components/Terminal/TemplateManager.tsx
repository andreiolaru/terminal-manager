import { useState, useEffect, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useTerminalStore } from '../../store/terminal-store'
import { listTemplatesSafe, saveTemplatesSafe } from '../../lib/ipc-api'
import { captureLayout } from '../../lib/layout-capture'
import type { LayoutTemplate } from '../../../shared/template-types'
import '../../assets/styles/template-manager.css'

interface TemplateManagerProps {
  onClose: () => void
}

export default function TemplateManager({ onClose }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<LayoutTemplate[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', icon: '', color: '' })
  const [editMode, setEditMode] = useState<'form' | 'json'>('form')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const groups = useTerminalStore((s) => s.groups)
  const activeGroupId = useTerminalStore((s) => s.activeGroupId)
  const terminals = useTerminalStore((s) => s.terminals)

  useEffect(() => {
    listTemplatesSafe().then(setTemplates)
  }, [])

  const persist = useCallback(async (updated: LayoutTemplate[]) => {
    if (isSaving) return
    setIsSaving(true)
    setTemplates(updated)
    try {
      await saveTemplatesSafe(updated)
    } finally {
      setIsSaving(false)
    }
  }, [isSaving])

  const handleSaveCurrent = (): void => {
    const group = groups.find((g) => g.id === activeGroupId)
    if (!group) return

    const layout = captureLayout(group.splitTree, terminals)
    const template: LayoutTemplate = {
      id: uuid(),
      name: group.label,
      icon: group.icon,
      color: group.color,
      backgroundGradient: group.backgroundGradient,
      layout
    }
    persist([...templates, template])
  }

  const handleDelete = (id: string): void => {
    persist(templates.filter((t) => t.id !== id))
  }

  const handleDuplicate = (tpl: LayoutTemplate): void => {
    const dup: LayoutTemplate = {
      ...tpl,
      id: uuid(),
      name: `${tpl.name} (copy)`
    }
    persist([...templates, dup])
  }

  const startEdit = (tpl: LayoutTemplate): void => {
    setEditingId(tpl.id)
    setEditForm({ name: tpl.name, icon: tpl.icon || '', color: tpl.color || '' })
    setJsonText(JSON.stringify(tpl, null, 2))
    setJsonError('')
    setEditMode('form')
  }

  const commitEdit = (): void => {
    if (!editingId) return

    if (editMode === 'json') {
      try {
        const parsed = JSON.parse(jsonText) as LayoutTemplate
        if (!parsed.name || !parsed.layout) {
          setJsonError('Template must have "name" and "layout" fields')
          return
        }
        const updated = templates.map((t) =>
          t.id === editingId ? { ...parsed, id: editingId } : t
        )
        persist(updated)
        setEditingId(null)
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
      }
      return
    }

    const updated = templates.map((t) =>
      t.id === editingId
        ? { ...t, name: editForm.name.trim() || t.name, icon: editForm.icon || undefined, color: editForm.color || undefined }
        : t
    )
    persist(updated)
    setEditingId(null)
  }

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="template-manager-overlay" onClick={handleOverlayClick}>
      <div className="template-manager-modal">
        <div className="template-manager-header">
          <h2>Manage Templates</h2>
          <button className="template-manager-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="template-manager-body">
          {editingId ? (
            <div className="template-editor">
              <div className="template-editor-tabs">
                <button
                  className={editMode === 'form' ? 'active' : ''}
                  onClick={() => setEditMode('form')}
                >
                  Properties
                </button>
                <button
                  className={editMode === 'json' ? 'active' : ''}
                  onClick={() => {
                    const tpl = templates.find((t) => t.id === editingId)
                    if (tpl && editMode === 'form') {
                      setJsonText(JSON.stringify(
                        { ...tpl, name: editForm.name.trim() || tpl.name, icon: editForm.icon || undefined, color: editForm.color || undefined },
                        null, 2
                      ))
                    }
                    setJsonError('')
                    setEditMode('json')
                  }}
                >
                  JSON
                </button>
              </div>
              {editMode === 'form' ? (
                <>
                  <div className="template-editor-field">
                    <label>Name</label>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className="template-editor-row">
                    <div className="template-editor-field">
                      <label>Icon</label>
                      <input
                        value={editForm.icon}
                        onChange={(e) => setEditForm((f) => ({ ...f, icon: e.target.value }))}
                        placeholder="e.g. BE, ##"
                        maxLength={4}
                      />
                    </div>
                    <div className="template-editor-field">
                      <label>Color</label>
                      <input
                        type="color"
                        value={editForm.color || '#007acc'}
                        onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="template-editor-field">
                  <label>Template JSON</label>
                  <textarea
                    className="template-json-editor"
                    value={jsonText}
                    onChange={(e) => { setJsonText(e.target.value); setJsonError('') }}
                    spellCheck={false}
                  />
                  {jsonError && <div className="template-json-error">{jsonError}</div>}
                </div>
              )}
              <div className="template-manager-footer" style={{ border: 'none', padding: '8px 0 0' }}>
                <button onClick={() => setEditingId(null)}>Cancel</button>
                <button className="primary" onClick={commitEdit}>Save</button>
              </div>
            </div>
          ) : (
            <div className="template-manager-list">
              {templates.length === 0 ? (
                <div className="template-manager-empty">
                  No templates. Save your current layout to get started.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div key={tpl.id} className="template-manager-card">
                    <span className="template-manager-card-icon" style={tpl.color ? { color: tpl.color } : undefined}>
                      {tpl.icon || '\u2588'}
                    </span>
                    <div className="template-manager-card-info">
                      <div className="template-manager-card-name">{tpl.name}</div>
                    </div>
                    <div className="template-manager-card-actions">
                      <button onClick={() => startEdit(tpl)} title="Edit">&#x270E;</button>
                      <button onClick={() => handleDuplicate(tpl)} title="Duplicate">&#x2398;</button>
                      <button className="delete-btn" onClick={() => handleDelete(tpl.id)} title="Delete">&times;</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        {!editingId && (
          <div className="template-manager-footer">
            <button className="primary" onClick={handleSaveCurrent} disabled={!activeGroupId || isSaving}>
              Save current layout as template
            </button>
            <button
              onClick={() => window.electronAPI.showTemplatesInFolder()}
              title="Open templates folder in file explorer"
            >
              Open folder
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
