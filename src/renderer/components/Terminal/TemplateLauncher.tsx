import { useState, useRef, useEffect } from 'react'
import { useTerminalStore } from '../../store/terminal-store'
import { listTemplatesSafe } from '../../lib/ipc-api'
import type { LayoutTemplate } from '../../../shared/template-types'

interface TemplateLauncherProps {
  onManageTemplates: () => void
}

export default function TemplateLauncher({ onManageTemplates }: TemplateLauncherProps) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<LayoutTemplate[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const instantiateLayout = useTerminalStore((s) => s.instantiateLayout)

  const handleToggle = async (): Promise<void> => {
    if (loadingRef.current) return
    setOpen((prev) => {
      if (!prev) {
        loadingRef.current = true
        listTemplatesSafe().then((list) => {
          setTemplates(list)
          loadingRef.current = false
        })
      }
      return !prev
    })
  }

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleSelect = (template: LayoutTemplate): void => {
    instantiateLayout(template)
    setOpen(false)
  }

  return (
    <div className="template-launcher" ref={dropdownRef}>
      <button
        className="template-launcher-btn"
        onClick={handleToggle}
        title="Launch template"
        aria-label="Launch template"
        aria-expanded={open}
      >
        &#x25BE;
      </button>
      {open && (
        <div className="template-dropdown" role="menu">
          {templates.length === 0 ? (
            <div className="template-dropdown-empty">No templates yet</div>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                className="template-dropdown-item"
                role="menuitem"
                onClick={() => handleSelect(tpl)}
              >
                {tpl.icon && <span className="template-icon">{tpl.icon}</span>}
                <span>{tpl.name}</span>
                {tpl.color && (
                  <span
                    className="template-color-dot"
                    style={{ backgroundColor: tpl.color }}
                  />
                )}
              </button>
            ))
          )}
          <div className="template-dropdown-separator" />
          <button
            className="template-dropdown-item"
            role="menuitem"
            onClick={() => { setOpen(false); onManageTemplates() }}
          >
            Manage Templates...
          </button>
        </div>
      )}
    </div>
  )
}
