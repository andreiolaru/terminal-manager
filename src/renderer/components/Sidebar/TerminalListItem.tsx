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

const statusLabels: Record<string, string> = {
  idle: 'Idle',
  working: 'Working...',
  'needs-input': 'Needs input',
  completed: 'Completed',
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
  const [editValue, setEditValue] = useState(terminal.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = (): void => {
    setEditValue(terminal.name)
    setIsEditing(true)
  }

  const commitRename = (): void => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== terminal.name) {
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

  const statusClass = terminal.claudeStatus && terminal.claudeStatus !== 'not-tracked'
    ? `claude-${terminal.claudeStatus}`
    : ''

  const className = [
    'terminal-list-item',
    isActive ? 'active' : '',
    !terminal.isAlive ? 'dead' : '',
    statusClass
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

  const claudeStatus = terminal.claudeStatus && terminal.claudeStatus !== 'not-tracked'
    ? terminal.claudeStatus
    : null
  const statusText = claudeStatus
    ? (terminal.claudeStatusTitle
      ? `${statusLabels[claudeStatus]} — ${terminal.claudeStatusTitle}`
      : statusLabels[claudeStatus])
    : null

  // Claude model/context info
  const claudeInfoParts: string[] = []
  if (terminal.claudeModel) claudeInfoParts.push(terminal.claudeModel)
  if (terminal.claudeContext) claudeInfoParts.push(`Ctx: ${terminal.claudeContext}`)
  const claudeInfoText = claudeInfoParts.length > 0 ? claudeInfoParts.join(' \u00B7 ') : null

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
      <div className="terminal-list-item-header">
        {claudeStatus && (
          <span className={`claude-status-icon ${claudeStatus}`}>
            {statusIcons[claudeStatus]}
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
          <span className="terminal-list-item-name">{terminal.name}</span>
        )}
        <button className="terminal-close-btn" onClick={handleClose} title="Close terminal" aria-label={`Close ${terminal.name}`}>
          ×
        </button>
      </div>
      {terminal.lastCommand && (
        <div className="terminal-list-item-command" title={terminal.lastCommand}>
          {terminal.lastCommand.length > 400 ? terminal.lastCommand.slice(0, 400) + '\u2026' : terminal.lastCommand}
        </div>
      )}
      {statusText && (
        <div className={`terminal-list-item-status ${claudeStatus}`}>
          {statusText}
        </div>
      )}
      {claudeInfoText && (
        <div className="terminal-list-item-info">
          {claudeInfoText}
        </div>
      )}
    </div>
  )
}
