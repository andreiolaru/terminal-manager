import { useTerminalStore } from '../../store/terminal-store'

export default function SidebarActions() {
  const addTerminal = useTerminalStore((s) => s.addTerminal)

  return (
    <div className="sidebar-actions">
      <button className="sidebar-btn" onClick={addTerminal} title="New Terminal">
        +
      </button>
    </div>
  )
}
