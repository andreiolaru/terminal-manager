import SidebarActions from './SidebarActions'
import TerminalList from './TerminalList'
import { useTerminalStore } from '../../store/terminal-store'
import '../../assets/styles/sidebar.css'

export default function Sidebar() {
  const collapsed = useTerminalStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar)

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-header">
        <button
          className="sidebar-btn sidebar-toggle"
          onClick={toggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
        {!collapsed && <span className="sidebar-title">Terminals</span>}
        {!collapsed && <SidebarActions />}
      </div>
      {!collapsed && <TerminalList />}
      {collapsed && <SidebarActions />}
    </aside>
  )
}
