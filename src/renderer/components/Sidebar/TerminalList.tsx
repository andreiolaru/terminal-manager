import { useTerminalStore } from '../../store/terminal-store'
import TerminalListItem from './TerminalListItem'

export default function TerminalList() {
  const terminals = useTerminalStore((s) => s.terminals)
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId)

  const sortedTerminals = Object.values(terminals).sort(
    (a, b) => a.createdAt - b.createdAt
  )

  return (
    <div className="terminal-list">
      {sortedTerminals.map((t) => (
        <TerminalListItem
          key={t.id}
          terminal={t}
          isActive={t.id === activeTerminalId}
        />
      ))}
    </div>
  )
}
