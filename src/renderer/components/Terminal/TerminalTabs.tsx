import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTerminalStore } from '../../store/terminal-store'
import TemplateLauncher from './TemplateLauncher'
import TemplateManager from './TemplateManager'
import '../../assets/styles/tabs.css'

export default function TerminalTabs() {
  const groups = useTerminalStore((s) => s.groups)
  const activeGroupId = useTerminalStore((s) => s.activeGroupId)
  const setActiveGroup = useTerminalStore((s) => s.setActiveGroup)
  const addGroup = useTerminalStore((s) => s.addGroup)
  const removeGroup = useTerminalStore((s) => s.removeGroup)
  const renameGroup = useTerminalStore((s) => s.renameGroup)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const handleDoubleClick = (groupId: string, label: string): void => {
    setEditValue(label)
    setEditingId(groupId)
  }

  const commitRename = (): void => {
    if (editingId) {
      const trimmed = editValue.trim()
      if (trimmed) {
        renameGroup(editingId, trimmed)
      }
      setEditingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      commitRename()
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  const handleClose = (e: React.MouseEvent, groupId: string): void => {
    e.stopPropagation()
    removeGroup(groupId)
  }

  return (
    <div className="terminal-tabs" role="tablist" aria-label="Terminal groups">
      {groups.map((group) => (
        <div
          key={group.id}
          className={`terminal-tab${group.id === activeGroupId ? ' active' : ''}`}
          role="tab"
          aria-selected={group.id === activeGroupId}
          tabIndex={group.id === activeGroupId ? 0 : -1}
          onClick={() => setActiveGroup(group.id)}
          onDoubleClick={() => handleDoubleClick(group.id, group.label)}
          style={group.color ? { '--tm-group-color': group.color } as React.CSSProperties : undefined}
        >
          {group.icon && <span className="terminal-tab-icon">{group.icon}</span>}
          {editingId === group.id ? (
            <input
              ref={inputRef}
              className="terminal-tab-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="terminal-tab-label">{group.label}</span>
          )}
          <button
            className="terminal-tab-close"
            onClick={(e) => handleClose(e, group.id)}
            title="Close Group"
            aria-label={`Close ${group.label}`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="terminal-tab-add"
        onClick={addGroup}
        title="New Group (Ctrl+Tab to cycle)"
        aria-label="New Group"
      >
        +
      </button>
      <TemplateLauncher onManageTemplates={() => setManagerOpen(true)} />
      {managerOpen && createPortal(
        <TemplateManager onClose={() => setManagerOpen(false)} />,
        document.body
      )}
    </div>
  )
}
