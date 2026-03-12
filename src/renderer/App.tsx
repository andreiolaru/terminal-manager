import { useEffect, useRef } from 'react'
import MainLayout from './components/Layout/MainLayout'
import TitleBar from './components/Layout/TitleBar'
import StatusBar from './components/Layout/StatusBar'
import { useTerminalStore, getSessionData } from './store/terminal-store'
import { serializeAddonRegistry, SERIALIZE_SCROLLBACK_ROWS } from './lib/serialize-registry'
import { usePtyIpc } from './hooks/usePtyIpc'
import { useShortcuts } from './hooks/useShortcuts'
import { initClaudeStatusDispatcher } from './lib/claude-status-dispatcher'
import { confirmAppClose } from './lib/claude-close-guard'
import { ipcApi, onShortcutSafe } from './lib/ipc-api'

function getSessionDataForSave(): import('../shared/session-types').SessionData {
  const state = useTerminalStore.getState()
  const session = getSessionData(state)
  if (state.restoreScrollback) {
    for (const [id, addon] of serializeAddonRegistry) {
      if (session.terminals[id]) {
        try {
          session.terminals[id].scrollback = addon.serialize({ scrollback: SERIALIZE_SCROLLBACK_ROWS })
        } catch {
          // Serialize can fail if terminal is disposed
        }
      }
    }
  }
  return session
}

function App() {
  const addGroup = useTerminalStore((s) => s.addGroup)
  const titleBarVisible = useTerminalStore((s) => s.titleBarVisible)
  const toggleTitleBar = useTerminalStore((s) => s.toggleTitleBar)
  const didInit = useRef(false)

  usePtyIpc()
  useShortcuts()

  // Initialize claude status dispatcher
  useEffect(() => {
    return initClaudeStatusDispatcher()
  }, [])

  // Handle app close confirmation for active Claude sessions
  useEffect(() => {
    if (!ipcApi?.onAppCloseRequested) return
    return ipcApi.onAppCloseRequested(() => {
      // Save session (with scrollback if enabled) immediately before closing
      ipcApi.saveSession(getSessionDataForSave())
      confirmAppClose().then((ok) => {
        if (ok) ipcApi.confirmAppClose()
        else ipcApi.cancelAppClose()
      })
    })
  }, [])

  // Push active terminal changes to main for notification suppression
  useEffect(() => {
    return useTerminalStore.subscribe(
      (state) => {
        const group = state.groups.find((g) => g.id === state.activeGroupId)
        return group?.activeTerminalId ?? null
      },
      (activeTerminalId) => {
        ipcApi.setActiveTerminalForNotifications(activeTerminalId)
      }
    )
  }, [])

  // Toggle title bar shortcut
  useEffect(() => {
    return onShortcutSafe('toggle-titlebar', toggleTitleBar)
  }, [toggleTitleBar])

  // Load session on startup, or create a fresh group
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      ipcApi.loadSession().then((session) => {
        if (session && session.groups.length > 0) {
          useTerminalStore.getState().restoreSession(session)
        } else {
          addGroup()
        }
      }).catch(() => {
        addGroup()
      })
    }
  }, [addGroup])

  // Auto-save session on state changes (debounced 2s)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const unsub = useTerminalStore.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        ipcApi.saveSession(getSessionData(useTerminalStore.getState()))
      }, 2000)
    })
    return () => { unsub(); clearTimeout(timer) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TitleBar visible={titleBarVisible} onHide={toggleTitleBar} onToggle={toggleTitleBar} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <MainLayout />
      </div>
      <StatusBar />
    </div>
  )
}

export default App
