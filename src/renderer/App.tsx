import { useEffect, useRef } from 'react'
import MainLayout from './components/Layout/MainLayout'
import StatusBar from './components/Layout/StatusBar'
import { useTerminalStore } from './store/terminal-store'
import { usePtyIpc } from './hooks/usePtyIpc'
import { useShortcuts } from './hooks/useShortcuts'
import { initClaudeStatusDispatcher } from './lib/claude-status-dispatcher'
import { ipcApi } from './lib/ipc-api'

function App() {
  const addGroup = useTerminalStore((s) => s.addGroup)
  const didInit = useRef(false)

  usePtyIpc()
  useShortcuts()

  // Initialize claude status dispatcher
  useEffect(() => {
    return initClaudeStatusDispatcher()
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

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      addGroup()
    }
  }, [addGroup])

  return (
    <>
      <MainLayout />
      <StatusBar />
    </>
  )
}

export default App
