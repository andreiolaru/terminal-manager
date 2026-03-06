import Sidebar from '../Sidebar/Sidebar'
import TerminalPanel from '../Terminal/TerminalPanel'

export default function MainLayout() {
  return (
    <div className="main-layout">
      <Sidebar />
      <TerminalPanel />
    </div>
  )
}
