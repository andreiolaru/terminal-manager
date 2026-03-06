import { ipcApi } from './ipc-api'
import { useTerminalStore } from '../store/terminal-store'
import type { ClaudeCodeStatus } from '../store/types'

let unsubStatus: (() => void) | null = null
let unsubFocus: (() => void) | null = null

export function initClaudeStatusDispatcher(): () => void {
  unsubStatus = ipcApi.onClaudeStatus((id: string, status: string, contextTitle?: string) => {
    useTerminalStore.getState().setClaudeStatus(id, status as ClaudeCodeStatus, contextTitle)
  })

  unsubFocus = ipcApi.onNotificationFocusTerminal((terminalId: string) => {
    useTerminalStore.getState().setActiveTerminal(terminalId)
  })

  return () => {
    unsubStatus?.()
    unsubFocus?.()
    unsubStatus = null
    unsubFocus = null
  }
}
