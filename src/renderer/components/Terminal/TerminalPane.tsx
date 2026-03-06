import { memo, useCallback } from 'react'
import { useTerminalStore } from '../../store/terminal-store'
import TerminalInstance from './TerminalInstance'
import '../../assets/styles/splitpane.css'
import '../../assets/styles/claude-status.css'

const statusIcons: Record<string, string> = {
  idle: '\u25CF',
  working: '\u25C6',
  'needs-input': '\u25C8',
  completed: '\u2713',
}

interface TerminalPaneProps {
  terminalId: string
  groupId: string
}

export default memo(function TerminalPane({ terminalId, groupId }: TerminalPaneProps) {
  const title = useTerminalStore((s) => s.terminals[terminalId]?.title ?? '')
  const isAlive = useTerminalStore((s) => s.terminals[terminalId]?.isAlive ?? true)
  const claudeStatus = useTerminalStore((s) => s.terminals[terminalId]?.claudeStatus)
  const isActive = useTerminalStore(
    (s) => s.groups.find((g) => g.id === groupId)?.activeTerminalId === terminalId
  )
  const isGroupActive = useTerminalStore((s) => s.activeGroupId === groupId)
  const splitTerminal = useTerminalStore((s) => s.splitTerminal)
  const removeTerminal = useTerminalStore((s) => s.removeTerminal)
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal)

  const handleSplitH = useCallback(() => splitTerminal(terminalId, 'horizontal'), [splitTerminal, terminalId])
  const handleSplitV = useCallback(() => splitTerminal(terminalId, 'vertical'), [splitTerminal, terminalId])
  const handleClose = useCallback(() => removeTerminal(terminalId), [removeTerminal, terminalId])
  const handleMouseDown = useCallback(() => setActiveTerminal(terminalId), [setActiveTerminal, terminalId])

  const statusClass = claudeStatus && claudeStatus !== 'not-tracked'
    ? ` claude-${claudeStatus}`
    : ''
  const className = `terminal-pane${isActive ? ' active' : ''}${!isAlive ? ' dead' : ''}${statusClass}`

  return (
    <div className={className} onMouseDown={handleMouseDown}>
      <div className="terminal-title-bar">
        {claudeStatus && claudeStatus !== 'not-tracked' && (
          <span className={`claude-status-icon ${claudeStatus}`}>
            {statusIcons[claudeStatus]}
          </span>
        )}
        <span className="title">{title}</span>
        <div className="terminal-title-actions">
          <button onClick={handleSplitH} title="Split Right (Ctrl+Shift+D)" aria-label="Split Right">
            ⫼
          </button>
          <button onClick={handleSplitV} title="Split Down (Ctrl+Shift+E)" aria-label="Split Down">
            ⊟
          </button>
          <button
            className="close-btn"
            onClick={handleClose}
            title="Close (Ctrl+Shift+W)"
            aria-label="Close terminal"
          >
            ×
          </button>
        </div>
      </div>
      <div className="terminal-content">
        <TerminalInstance terminalId={terminalId} isVisible={isGroupActive} isActive={isActive} />
      </div>
    </div>
  )
})
