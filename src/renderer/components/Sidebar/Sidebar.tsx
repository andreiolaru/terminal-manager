import SidebarActions from './SidebarActions'
import TerminalList from './TerminalList'
import '../../assets/styles/sidebar.css'

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Terminals</span>
        <SidebarActions />
      </div>
      <TerminalList />
    </aside>
  )
}
