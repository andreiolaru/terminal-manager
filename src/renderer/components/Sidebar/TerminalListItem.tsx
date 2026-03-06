import { useState, useRef, useEffect } from 'react'
import type { TerminalInfo } from '../../store/types'
import { useTerminalStore } from '../../store/terminal-store'

interface TerminalListItemProps {
  terminal: TerminalInfo
  isActive: boolean
}

export default function TerminalListItem({ terminal, isActive }: TerminalListItemProps) {
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal)
  const removeTerminal = useTerminalStore((s) => s.removeTerminal)
  const renameTerminal = useTerminalStore((s) => s.renameTerminal)

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(terminal.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = (): void => {
    setEditValue(terminal.title)
    setIsEditing(true)
  }

  const commitRename = (): void => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== terminal.title) {
      renameTerminal(terminal.id, trimmed)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      commitRename()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const handleClose = (e: React.MouseEvent): void => {
    e.stopPropagation()
    removeTerminal(terminal.id)
  }

  const className = [
    'terminal-list-item',
    isActive ? 'active' : '',
    !terminal.isAlive ? 'dead' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} onClick={() => setActiveTerminal(terminal.id)} onDoubleClick={handleDoubleClick}>
      {isEditing ? (
        <input
          ref={inputRef}
          className="terminal-rename-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span className="terminal-list-item-title">{terminal.title}</span>
      )}
      <button className="terminal-close-btn" onClick={handleClose} title="Close terminal">
        ×
      </button>
    </div>
  )
}
