import { useEffect, useRef } from 'react'
import MainLayout from './components/Layout/MainLayout'
import { useTerminalStore } from './store/terminal-store'
import { usePtyIpc } from './hooks/usePtyIpc'

function App() {
  const addTerminal = useTerminalStore((s) => s.addTerminal)
  const didInit = useRef(false)

  usePtyIpc()

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      addTerminal()
    }
  }, [addTerminal])

  return <MainLayout />
}

export default App
