import { useEffect, useRef } from 'react'
import { useTerminalStore } from '../../store/terminal-store'
import '../../assets/styles/font-size-menu.css'

interface FontSizeMenuProps {
  terminalId: string
  groupId: string
  onClose: () => void
}

export default function FontSizeMenu({ terminalId, groupId, onClose }: FontSizeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const globalFontSize = useTerminalStore((s) => s.globalFontSize)
  const groupFontSize = useTerminalStore((s) => s.groups.find((g) => g.id === groupId)?.fontSize)
  const terminalFontSize = useTerminalStore((s) => s.terminals[terminalId]?.fontSize)

  const setGlobalFontSize = useTerminalStore((s) => s.setGlobalFontSize)
  const setGroupFontSize = useTerminalStore((s) => s.setGroupFontSize)
  const setTerminalFontSize = useTerminalStore((s) => s.setTerminalFontSize)

  // Resolved effective size for display
  const effective = terminalFontSize ?? groupFontSize ?? globalFontSize

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div ref={menuRef} className="font-size-menu" onClick={(e) => e.stopPropagation()}>
      <div className="font-size-menu-section">
        <span className="font-size-menu-label">Terminal</span>
        <div className="font-size-menu-controls">
          <button onClick={() => setTerminalFontSize(terminalId, (terminalFontSize ?? effective) - 1)}>-</button>
          <span className="font-size-menu-value">
            {terminalFontSize ?? <span className="font-size-inherited">inherited</span>}
          </span>
          <button onClick={() => setTerminalFontSize(terminalId, (terminalFontSize ?? effective) + 1)}>+</button>
          {terminalFontSize !== undefined && (
            <button className="font-size-reset" onClick={() => setTerminalFontSize(terminalId, undefined)} title="Reset to inherited">x</button>
          )}
        </div>
      </div>

      <div className="font-size-menu-section">
        <span className="font-size-menu-label">Group</span>
        <div className="font-size-menu-controls">
          <button onClick={() => setGroupFontSize(groupId, (groupFontSize ?? globalFontSize) - 1)}>-</button>
          <span className="font-size-menu-value">
            {groupFontSize ?? <span className="font-size-inherited">inherited</span>}
          </span>
          <button onClick={() => setGroupFontSize(groupId, (groupFontSize ?? globalFontSize) + 1)}>+</button>
          {groupFontSize !== undefined && (
            <button className="font-size-reset" onClick={() => setGroupFontSize(groupId, undefined)} title="Reset to inherited">x</button>
          )}
        </div>
      </div>

      <div className="font-size-menu-section">
        <span className="font-size-menu-label">Global</span>
        <div className="font-size-menu-controls">
          <button onClick={() => setGlobalFontSize(globalFontSize - 1)}>-</button>
          <span className="font-size-menu-value">{globalFontSize}</span>
          <button onClick={() => setGlobalFontSize(globalFontSize + 1)}>+</button>
        </div>
      </div>

      <div className="font-size-menu-effective">
        Effective: {effective}px
      </div>
    </div>
  )
}
