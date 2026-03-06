import { useTerminalStore } from '../../store/terminal-store'
import TerminalInstance from './TerminalInstance'

export default function TerminalPanel() {
  const terminals = useTerminalStore((s) => s.terminals)
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId)

  return (
    <div className="terminal-panel">
      {Object.keys(terminals).map((id) => (
        <TerminalInstance
          key={id}
          terminalId={id}
          isVisible={id === activeTerminalId}
        />
      ))}
      {activeTerminalId === null && (
        <div className="terminal-panel-empty">
          No terminals open. Click "+" to create one.
        </div>
      )}
    </div>
  )
}
