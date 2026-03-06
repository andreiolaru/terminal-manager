import { useCallback, useRef, useState } from 'react'
import SidebarActions from './SidebarActions'
import TerminalList from './TerminalList'
import { useTerminalStore } from '../../store/terminal-store'
import '../../assets/styles/sidebar.css'

const MIN_WIDTH = 140
const MAX_WIDTH = 500
const DEFAULT_WIDTH = 220

export default function Sidebar() {
  const collapsed = useTerminalStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent): void => {
      if (!dragging.current) return
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX))
      setWidth(newWidth)
    }

    const onMouseUp = (): void => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <aside
      className={`sidebar${collapsed ? ' collapsed' : ''}`}
      style={collapsed ? undefined : { width, minWidth: MIN_WIDTH }}
    >
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
      {!collapsed && <div className="sidebar-resize-handle" onMouseDown={onMouseDown} />}
    </aside>
  )
}
