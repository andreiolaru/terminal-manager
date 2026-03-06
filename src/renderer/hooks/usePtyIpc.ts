import { useEffect } from 'react'
import { ipcApi } from '../lib/ipc-api'
import { useTerminalStore } from '../store/terminal-store'

export function usePtyIpc(): void {
  const setTerminalDead = useTerminalStore((s) => s.setTerminalDead)

  useEffect(() => {
    const unsubExit = ipcApi.onPtyExit((id: string, _exitCode: number) => {
      setTerminalDead(id)
    })

    return () => {
      unsubExit()
    }
  }, [setTerminalDead])
}
