import { useTerminalStore } from '../../store/terminal-store'
import TerminalInstance from './TerminalInstance'
import '../../assets/styles/splitpane.css'

interface TerminalPaneProps {
  terminalId: string
}

export default function TerminalPane({ terminalId }: TerminalPaneProps) {
  const title = useTerminalStore((s) => s.terminals[terminalId]?.title ?? '')
  const isActive = useTerminalStore((s) => s.activeTerminalId === terminalId)
  const splitTerminal = useTerminalStore((s) => s.splitTerminal)
  const removeTerminal = useTerminalStore((s) => s.removeTerminal)
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal)

  const className = `terminal-pane${isActive ? ' active' : ''}`

  return (
    <div className={className} onMouseDown={() => setActiveTerminal(terminalId)}>
      <div className="terminal-title-bar">
        <span className="title">{title}</span>
        <div className="terminal-title-actions">
          <button
            onClick={() => splitTerminal(terminalId, 'horizontal')}
            title="Split Right"
          >
            ⫼
          </button>
          <button
            onClick={() => splitTerminal(terminalId, 'vertical')}
            title="Split Down"
          >
            ⊟
          </button>
          <button
            className="close-btn"
            onClick={() => removeTerminal(terminalId)}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>
      <div className="terminal-content">
        <TerminalInstance terminalId={terminalId} isVisible={true} />
      </div>
    </div>
  )
}
