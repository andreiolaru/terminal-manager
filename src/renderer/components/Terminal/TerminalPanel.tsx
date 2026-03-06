import { useTerminalStore } from '../../store/terminal-store'
import SplitContainer from '../SplitPane/SplitContainer'
import TerminalTabs from './TerminalTabs'

export default function TerminalPanel() {
  const groups = useTerminalStore((s) => s.groups)
  const activeGroupId = useTerminalStore((s) => s.activeGroupId)

  return (
    <div className="terminal-panel">
      <TerminalTabs />
      <div className="terminal-panel-content">
        {groups.length === 0 ? (
          <div className="terminal-panel-empty">
            No terminals open. Click &ldquo;+&rdquo; to create a group.
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className="terminal-group-container"
              style={{ display: group.id === activeGroupId ? 'flex' : 'none' }}
            >
              <SplitContainer node={group.splitTree} groupId={group.id} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
