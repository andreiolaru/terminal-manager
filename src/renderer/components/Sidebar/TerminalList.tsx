import { useTerminalStore } from '../../store/terminal-store'
import { collectLeafIds } from '../../lib/tree-utils'
import TerminalListItem from './TerminalListItem'

export default function TerminalList() {
  const terminals = useTerminalStore((s) => s.terminals)
  const groups = useTerminalStore((s) => s.groups)
  const activeGroupId = useTerminalStore((s) => s.activeGroupId)

  const activeGroup = groups.find((g) => g.id === activeGroupId)
  const groupTerminalIds = activeGroup ? collectLeafIds(activeGroup.splitTree) : []
  const activeTerminalId = activeGroup?.activeTerminalId ?? null

  const sortedTerminals = groupTerminalIds
    .map((id) => terminals[id])
    .filter(Boolean)
    .sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div className="terminal-list" role="listbox" aria-label="Terminal sessions">
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
