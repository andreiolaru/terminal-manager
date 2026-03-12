import { useState, useEffect, useRef } from 'react'
import { ipcApi } from '../../lib/ipc-api'
import { useTerminalStore } from '../../store/terminal-store'
import { confirmTerminalClose } from '../../lib/claude-close-guard'
import '../../assets/styles/titlebar.css'

interface MenuItem {
  label: string
  shortcut?: string
  action: () => void
}

interface MenuSeparator {
  separator: true
}

type MenuEntry = MenuItem | MenuSeparator

function getMenus(onToggle: () => void): Record<string, MenuEntry[]> {
  const s = useTerminalStore.getState
  const group = () => s().groups.find((g) => g.id === s().activeGroupId)

  return {
    File: [
      { label: 'New Terminal', shortcut: 'Ctrl+Shift+T', action: () => s().addTerminal() },
      { label: 'Close Terminal', shortcut: 'Ctrl+Shift+W', action: () => {
        const g = group()
        if (g) confirmTerminalClose(g.activeTerminalId).then((ok) => { if (ok) s().removeTerminal(g.activeTerminalId) })
      }},
      { separator: true },
      { label: 'Quit', shortcut: 'Alt+F4', action: () => ipcApi.windowClose() },
    ],
    Edit: [
      { label: 'Copy', shortcut: 'Ctrl+Shift+C', action: () => document.execCommand('copy') },
      { label: 'Paste', shortcut: 'Ctrl+Shift+V', action: async () => {
        try {
          const text = await navigator.clipboard.readText()
          if (text) navigator.clipboard.writeText(text)
        } catch { /* */ }
      }},
    ],
    View: [
      { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => s().toggleSidebar() },
      { separator: true },
      { label: 'Split Right', shortcut: 'Ctrl+Shift+D', action: () => {
        const g = group()
        if (g) s().splitTerminal(g.activeTerminalId, 'horizontal')
      }},
      { label: 'Split Down', shortcut: 'Ctrl+Shift+E', action: () => {
        const g = group()
        if (g) s().splitTerminal(g.activeTerminalId, 'vertical')
      }},
      { separator: true },
      { label: 'Zoom In', action: () => ipcApi.windowMenuAction('zoom-in') },
      { label: 'Zoom Out', action: () => ipcApi.windowMenuAction('zoom-out') },
      { label: 'Reset Zoom', action: () => ipcApi.windowMenuAction('zoom-reset') },
      { separator: true },
      { label: `${s().restoreScrollback ? '✓ ' : ''}Restore Scrollback`, action: () => s().toggleRestoreScrollback() },
    ],
    Shortcuts: [
      { label: 'New Terminal', shortcut: 'Ctrl+Shift+T', action: () => s().addTerminal() },
      { label: 'Close Terminal', shortcut: 'Ctrl+Shift+W', action: () => {
        const g = group()
        if (g) confirmTerminalClose(g.activeTerminalId).then((ok) => { if (ok) s().removeTerminal(g.activeTerminalId) })
      }},
      { separator: true },
      { label: 'Split Right', shortcut: 'Ctrl+Shift+D', action: () => {
        const g = group()
        if (g) s().splitTerminal(g.activeTerminalId, 'horizontal')
      }},
      { label: 'Split Down', shortcut: 'Ctrl+Shift+E', action: () => {
        const g = group()
        if (g) s().splitTerminal(g.activeTerminalId, 'vertical')
      }},
      { separator: true },
      { label: 'Cycle Group Forward', shortcut: 'Ctrl+Tab', action: () => s().cycleGroup(1) },
      { label: 'Cycle Group Backward', shortcut: 'Ctrl+Shift+Tab', action: () => s().cycleGroup(-1) },
      { separator: true },
      { label: 'Navigate Left', shortcut: 'Alt+Left', action: () => s().navigatePane('left') },
      { label: 'Navigate Right', shortcut: 'Alt+Right', action: () => s().navigatePane('right') },
      { label: 'Navigate Up', shortcut: 'Alt+Up', action: () => s().navigatePane('up') },
      { label: 'Navigate Down', shortcut: 'Alt+Down', action: () => s().navigatePane('down') },
      { separator: true },
      { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => s().toggleSidebar() },
      { label: 'Toggle Title Bar', shortcut: 'Ctrl+Shift+B', action: onToggle },
    ],
    Help: [
      { label: 'About Terminal Manager', action: () => ipcApi.windowMenuAction('about') },
    ],
  }
}

export default function TitleBar({ visible, onHide, onToggle }: { visible: boolean; onHide: () => void; onToggle: () => void }) {
  const [maximized, setMaximized] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible) {
      ipcApi.windowIsMaximized?.().then(setMaximized)
      ipcApi.windowIsAlwaysOnTop?.().then(setPinned)
    }
  }, [visible])

  const handlePin = (): void => {
    const next = !pinned
    setPinned(next)
    ipcApi.windowSetAlwaysOnTop(next)
  }

  useEffect(() => {
    if (!openMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenu])

  if (!visible) return null

  const menus = getMenus(onToggle)

  const handleItemClick = (entry: MenuEntry) => {
    if ('separator' in entry && entry.separator) return
    setOpenMenu(null)
    entry.action()
  }

  return (
    <div className="titlebar">
      <div className="titlebar-menus" ref={menuBarRef}>
        {Object.entries(menus).map(([label, items]) => (
          <div key={label} className="titlebar-menu-wrapper">
            <button
              className={`titlebar-menu-item ${openMenu === label ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === label ? null : label)}
              onMouseEnter={() => { if (openMenu) setOpenMenu(label) }}
            >
              {label}
            </button>
            {openMenu === label && (
              <div className="titlebar-dropdown">
                {items.map((entry, i) =>
                  'separator' in entry && entry.separator ? (
                    <div key={i} className="titlebar-dropdown-separator" />
                  ) : (
                    <button
                      key={i}
                      className="titlebar-dropdown-item"
                      onClick={() => handleItemClick(entry)}
                    >
                      <span>{entry.label}</span>
                      {entry.shortcut && <span className="titlebar-dropdown-shortcut">{entry.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        <button className={`titlebar-btn${pinned ? ' titlebar-pin-active' : ''}`} onClick={handlePin} title={pinned ? 'Unpin window' : 'Pin on top'}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M5 1v6M3 3l2-2 2 2M3 9h4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button className="titlebar-btn" onClick={onHide} title="Hide title bar">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 4l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2 8l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button className="titlebar-btn" onClick={() => ipcApi.windowMinimize()} title="Minimize">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        <button className="titlebar-btn" onClick={() => { ipcApi.windowMaximize(); setMaximized(!maximized) }} title={maximized ? 'Restore' : 'Maximize'}>
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2.5 2.5V0.5h7v7h-2" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </button>
        <button className="titlebar-btn titlebar-close" onClick={() => ipcApi.windowClose()} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
