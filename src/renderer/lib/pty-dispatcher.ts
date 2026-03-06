import type { Terminal } from '@xterm/xterm'
import { ipcApi } from './ipc-api'
import { useTerminalStore } from '../store/terminal-store'

type ExitCallback = (exitCode: number) => void

const terminals = new Map<string, Terminal>()
const exitCallbacks = new Map<string, ExitCallback>()

let unsubData: (() => void) | null = null
let unsubExit: (() => void) | null = null

function ensureListeners(): void {
  if (unsubData) return

  unsubData = ipcApi.onPtyData((id, data) => {
    terminals.get(id)?.write(data)
  })

  unsubExit = ipcApi.onPtyExit((id, exitCode) => {
    exitCallbacks.get(id)?.(exitCode)
    useTerminalStore.getState().setTerminalDead(id)
  })
}

export function registerTerminal(id: string, terminal: Terminal, onExit: ExitCallback): void {
  ensureListeners()
  terminals.set(id, terminal)
  exitCallbacks.set(id, onExit)
}

export function unregisterTerminal(id: string): void {
  terminals.delete(id)
  exitCallbacks.delete(id)

  if (terminals.size === 0) {
    unsubData?.()
    unsubExit?.()
    unsubData = null
    unsubExit = null
  }
}

export function _resetForTesting(): void {
  terminals.clear()
  exitCallbacks.clear()
  unsubData?.()
  unsubExit?.()
  unsubData = null
  unsubExit = null
}
