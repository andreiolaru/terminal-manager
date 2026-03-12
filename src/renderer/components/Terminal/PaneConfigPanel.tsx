import type { TerminalSlot } from '../../../shared/template-types'

interface PaneConfigPanelProps {
  terminal: TerminalSlot
  onChange: (updated: TerminalSlot) => void
}

export default function PaneConfigPanel({ terminal, onChange }: PaneConfigPanelProps) {
  const update = (field: keyof TerminalSlot, value: string | boolean) => {
    onChange({ ...terminal, [field]: value || undefined })
  }

  return (
    <div className="tve-pane-config">
      <div className="tve-pane-config-fields">
        <div className="template-editor-field">
          <label>Title</label>
          <input
            value={terminal.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>
        <div className="template-editor-field">
          <label>Shell</label>
          <input
            value={terminal.shell || ''}
            onChange={(e) => update('shell', e.target.value)}
            placeholder="default"
          />
        </div>
        <div className="template-editor-field">
          <label>Working directory</label>
          <input
            value={terminal.cwd || ''}
            onChange={(e) => update('cwd', e.target.value)}
            placeholder="default"
          />
        </div>
        <div className="template-editor-field">
          <label>Startup command</label>
          <input
            value={terminal.startupCommand || ''}
            onChange={(e) => update('startupCommand', e.target.value)}
            placeholder="none"
          />
        </div>
      </div>
      <label className="tve-checkbox-row">
        <input
          type="checkbox"
          checked={terminal.claudeCode || false}
          onChange={(e) => update('claudeCode', e.target.checked)}
        />
        <span>Claude Code terminal</span>
      </label>
    </div>
  )
}
