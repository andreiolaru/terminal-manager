import { useTerminalStore } from '../../store/terminal-store'
import SplitContainer from '../SplitPane/SplitContainer'
import TerminalTabs from './TerminalTabs'
import { hexToRgba, buildGradient } from '../../lib/color-utils'

export default function TerminalPanel() {
  const groups = useTerminalStore((s) => s.groups)
  const activeGroupId = useTerminalStore((s) => s.activeGroupId)

  return (
    <div className="terminal-panel">
      <TerminalTabs />
      <div className="terminal-panel-content">
        {groups.length === 0 ? (
          <div className="terminal-panel-empty">
            Press <kbd>Ctrl+Shift+T</kbd> or click &ldquo;+&rdquo; to create a terminal.
          </div>
        ) : (
          groups.map((group) => {
            const style: Record<string, string> = {
              display: group.id === activeGroupId ? 'flex' : 'none'
            }
            if (group.color) {
              style['--tm-group-color'] = group.color
              style['--tm-group-color-bg'] = hexToRgba(group.color, 0.08)
            }
            if (group.backgroundGradient) {
              style['--tm-group-gradient'] = buildGradient(group.backgroundGradient)
            }
            return (
            <div
              key={group.id}
              className="terminal-group-container"
              style={style as React.CSSProperties}
            >
              <SplitContainer node={group.splitTree} groupId={group.id} />
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
