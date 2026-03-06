import { useSyncExternalStore, useCallback } from 'react'
import { useTerminalStore } from '../../store/terminal-store'
import '../../assets/styles/status-bar.css'

const statusLabels: Record<string, string> = {
  idle: 'Idle',
  working: 'Working',
  'needs-input': 'Needs input',
  completed: 'Completed',
}

const statusIcons: Record<string, string> = {
  idle: '\u25CF',
  working: '\u25C6',
  'needs-input': '\u25C8',
  completed: '\u2713',
}

// Stable string key for tracked terminal IDs — only causes re-render when the set changes
function useTrackedIds(): string[] {
  const ids = useSyncExternalStore(
    useTerminalStore.subscribe,
    () => {
      const s = useTerminalStore.getState()
      const tracked: string[] = []
      for (const t of Object.values(s.terminals)) {
        if (t.claudeStatus && t.claudeStatus !== 'not-tracked') {
          tracked.push(t.id)
        }
      }
      return tracked.join(',')
    }
  )
  return ids ? ids.split(',') : []
}

function StatusBarItem({ id }: { id: string }) {
  const title = useTerminalStore((s) => s.terminals[id]?.name ?? '')
  const status = useTerminalStore((s) => s.terminals[id]?.claudeStatus ?? 'idle')
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal)
  const handleClick = useCallback(() => setActiveTerminal(id), [setActiveTerminal, id])

  const label = statusLabels[status] ?? status
  const icon = statusIcons[status] ?? ''
  const titleShort = title.length > 20 ? title.slice(0, 20) + '\u2026' : title

  return (
    <button
      className={`status-bar-item ${status}`}
      title={`${title} \u2014 ${label}`}
      onClick={handleClick}
    >
      <span className={`status-bar-icon ${status}`}>{icon}</span>
      <span className="status-bar-label">{titleShort}</span>
      <span className="status-bar-status">{label}</span>
    </button>
  )
}

function GlobalFontSize() {
  const globalFontSize = useTerminalStore((s) => s.globalFontSize)
  const setGlobalFontSize = useTerminalStore((s) => s.setGlobalFontSize)

  return (
    <div className="status-bar-font-size">
      <button onClick={() => setGlobalFontSize(globalFontSize - 1)} title="Decrease font size">-</button>
      <span title="Global font size">{globalFontSize}px</span>
      <button onClick={() => setGlobalFontSize(globalFontSize + 1)} title="Increase font size">+</button>
    </div>
  )
}

export default function StatusBar() {
  const trackedIds = useTrackedIds()

  return (
    <div className="status-bar">
      {trackedIds.map((id) => (
        <StatusBarItem key={id} id={id} />
      ))}
      <div className="status-bar-spacer" />
      <GlobalFontSize />
    </div>
  )
}
