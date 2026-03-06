import { useState, useRef, useEffect } from 'react'
import type { TerminalInfo } from '../../store/types'
import { useTerminalStore } from '../../store/terminal-store'
import { confirmTerminalClose } from '../../lib/claude-close-guard'
import '../../assets/styles/claude-status.css'

const statusIcons: Record<string, string> = {
  idle: '\u25CF',
  working: '\u25C6',
  'needs-input': '\u25C8',
  completed: '\u2713',
}

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

  const handleClose = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (await confirmTerminalClose(terminal.id)) removeTerminal(terminal.id)
  }

  const className = [
    'terminal-list-item',
    isActive ? 'active' : '',
    !terminal.isAlive ? 'dead' : ''
  ]
    .filter(Boolean)
    .join(' ')

  // C11: Keyboard handler for list item activation (skip when editing)
  const handleItemKeyDown = (e: React.KeyboardEvent): void => {
    if (isEditing) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setActiveTerminal(terminal.id)
    } else if (e.key === 'Delete') {
      confirmTerminalClose(terminal.id).then((ok) => { if (ok) removeTerminal(terminal.id) })
    }
  }

  return (
    <div
      className={className}
      onClick={() => setActiveTerminal(terminal.id)}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleItemKeyDown}
      role="option"
      tabIndex={0}
      aria-selected={isActive}
    >
      {terminal.claudeStatus && terminal.claudeStatus !== 'not-tracked' && (
        <span className={`claude-status-icon ${terminal.claudeStatus}`}>
          {statusIcons[terminal.claudeStatus]}
        </span>
      )}
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
        <span className="terminal-list-item-title" title={terminal.title}>
          {terminal.title.length > 25 ? terminal.title.slice(0, 25) + '\u2026' : terminal.title}
        </span>
      )}
      <button className="terminal-close-btn" onClick={handleClose} title="Close terminal" aria-label={`Close ${terminal.title}`}>
        ×
      </button>
    </div>
  )
}
