import { useTerminalStore } from '../../store/terminal-store'

export default function SidebarActions() {
  const addTerminal = useTerminalStore((s) => s.addTerminal)
  const addGroup = useTerminalStore((s) => s.addGroup)

  return (
    <div className="sidebar-actions">
      <button className="sidebar-btn" onClick={addTerminal} title="New Terminal (Ctrl+Shift+T)">
        +
      </button>
      <button className="sidebar-btn" onClick={addGroup} title="New Group (Ctrl+Tab to cycle)">
        &#8862;
      </button>
    </div>
  )
}
