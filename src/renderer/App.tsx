import { useEffect, useRef } from 'react'
import MainLayout from './components/Layout/MainLayout'
import TitleBar from './components/Layout/TitleBar'
import StatusBar from './components/Layout/StatusBar'
import { useTerminalStore } from './store/terminal-store'
import { usePtyIpc } from './hooks/usePtyIpc'
import { useShortcuts } from './hooks/useShortcuts'
import { initClaudeStatusDispatcher } from './lib/claude-status-dispatcher'
import { confirmAppClose } from './lib/claude-close-guard'
import { ipcApi, onShortcutSafe } from './lib/ipc-api'

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

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      addGroup()
    }
  }, [addGroup])

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
