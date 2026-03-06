import { useState, useRef, useEffect } from 'react'
import { useTerminalStore } from '../../store/terminal-store'
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
    <div className="terminal-tabs">
      {groups.map((group) => (
        <div
          key={group.id}
          className={`terminal-tab${group.id === activeGroupId ? ' active' : ''}`}
          onClick={() => setActiveGroup(group.id)}
          onDoubleClick={() => handleDoubleClick(group.id, group.label)}
        >
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
          >
            ×
          </button>
        </div>
      ))}
      <button className="terminal-tab-add" onClick={addGroup} title="New Group">
        +
      </button>
    </div>
  )
}
