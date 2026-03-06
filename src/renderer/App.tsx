import { useEffect, useRef } from 'react'
import MainLayout from './components/Layout/MainLayout'
import { useTerminalStore } from './store/terminal-store'
import { usePtyIpc } from './hooks/usePtyIpc'

function App() {
  const addGroup = useTerminalStore((s) => s.addGroup)
  const didInit = useRef(false)

  usePtyIpc()

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      addGroup()
    }
  }, [addGroup])

  return <MainLayout />
}

export default App
