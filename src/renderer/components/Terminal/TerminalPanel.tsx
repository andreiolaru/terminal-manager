import { useTerminalStore } from '../../store/terminal-store'
import SplitContainer from '../SplitPane/SplitContainer'

export default function TerminalPanel() {
  const splitTree = useTerminalStore((s) => s.splitTree)

  return (
    <div className="terminal-panel">
      {splitTree ? (
        <SplitContainer node={splitTree} />
      ) : (
        <div className="terminal-panel-empty">
          No terminals open. Click &ldquo;+&rdquo; to create one.
        </div>
      )}
    </div>
  )
}
