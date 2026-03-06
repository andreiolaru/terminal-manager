import { memo, useCallback, useState } from 'react'
import { useTerminalStore } from '../../store/terminal-store'
import { confirmTerminalClose } from '../../lib/claude-close-guard'
import TerminalInstance from './TerminalInstance'
import FontSizeMenu from './FontSizeMenu'
import '../../assets/styles/splitpane.css'
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

interface TerminalPaneProps {
  terminalId: string
  groupId: string
}

export default memo(function TerminalPane({ terminalId, groupId }: TerminalPaneProps) {
  const name = useTerminalStore((s) => s.terminals[terminalId]?.name ?? '')
  const lastCommand = useTerminalStore((s) => s.terminals[terminalId]?.lastCommand)
  const isAlive = useTerminalStore((s) => s.terminals[terminalId]?.isAlive ?? true)
  const claudeStatus = useTerminalStore((s) => s.terminals[terminalId]?.claudeStatus)
  const claudeStatusTitle = useTerminalStore((s) => s.terminals[terminalId]?.claudeStatusTitle)
  const claudeModel = useTerminalStore((s) => s.terminals[terminalId]?.claudeModel)
  const claudeContext = useTerminalStore((s) => s.terminals[terminalId]?.claudeContext)
  const isActive = useTerminalStore(
    (s) => s.groups.find((g) => g.id === groupId)?.activeTerminalId === terminalId
  )
  const isGroupActive = useTerminalStore((s) => s.activeGroupId === groupId)
  const splitTerminal = useTerminalStore((s) => s.splitTerminal)
  const removeTerminal = useTerminalStore((s) => s.removeTerminal)
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal)
  const [fontMenuOpen, setFontMenuOpen] = useState(false)

  const handleSplitH = useCallback(() => splitTerminal(terminalId, 'horizontal'), [splitTerminal, terminalId])
  const handleSplitV = useCallback(() => splitTerminal(terminalId, 'vertical'), [splitTerminal, terminalId])
  const handleClose = useCallback(async () => {
    if (await confirmTerminalClose(terminalId)) removeTerminal(terminalId)
  }, [removeTerminal, terminalId])
  const handleMouseDown = useCallback(() => setActiveTerminal(terminalId), [setActiveTerminal, terminalId])

  const statusClass = claudeStatus && claudeStatus !== 'not-tracked'
    ? ` claude-${claudeStatus}`
    : ''
  const className = `terminal-pane${isActive ? ' active' : ''}${!isAlive ? ' dead' : ''}${statusClass}`

  const hasStatus = claudeStatus && claudeStatus !== 'not-tracked'
  const statusText = hasStatus
    ? (claudeStatusTitle
      ? `${statusLabels[claudeStatus]} — ${claudeStatusTitle}`
      : statusLabels[claudeStatus])
    : null

  return (
    <div className={className} onMouseDown={handleMouseDown}>
      <div className="terminal-title-bar">
        {hasStatus && (
          <span className={`claude-status-icon ${claudeStatus}`}>
            {statusIcons[claudeStatus]}
          </span>
        )}
        <div className="terminal-title-content">
          <span className="terminal-title-name">{name}</span>
          {lastCommand && (
            <span className="terminal-title-command" title={lastCommand}>
              {lastCommand.length > 200 ? lastCommand.slice(0, 200) + '\u2026' : lastCommand}
            </span>
          )}
          {statusText && (
            <span className={`terminal-title-status ${claudeStatus}`}>
              {statusText}
            </span>
          )}
        </div>
        <div className="terminal-title-right">
          <div className="terminal-title-actions">
            <button
              onClick={(e) => { e.stopPropagation(); setFontMenuOpen(!fontMenuOpen) }}
              title="Font size"
              aria-label="Font size"
              className={fontMenuOpen ? 'active' : ''}
            >
              A
            </button>
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
          {(claudeModel || claudeContext) && (
            <div className="terminal-title-info-badge">
              {claudeModel}{claudeModel && claudeContext ? ' \u00B7 ' : ''}{claudeContext ? `Ctx: ${claudeContext}` : ''}
            </div>
          )}
        </div>
        {fontMenuOpen && (
          <FontSizeMenu
            terminalId={terminalId}
            groupId={groupId}
            onClose={() => setFontMenuOpen(false)}
          />
        )}
      </div>
      <div className="terminal-content">
        <TerminalInstance terminalId={terminalId} isVisible={isGroupActive} isActive={isActive} />
      </div>
    </div>
  )
})
