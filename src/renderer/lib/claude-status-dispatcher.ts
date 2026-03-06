import { ipcApi } from './ipc-api'
import { useTerminalStore } from '../store/terminal-store'
import type { ClaudeCodeStatus } from '../store/types'

let unsubStatus: (() => void) | null = null
let unsubInfo: (() => void) | null = null
let unsubFocus: (() => void) | null = null

export function initClaudeStatusDispatcher(): () => void {
  unsubStatus = ipcApi.onClaudeStatus((id: string, status: string, contextTitle?: string) => {
    useTerminalStore.getState().setClaudeStatus(id, status as ClaudeCodeStatus, contextTitle)
  })

  unsubInfo = ipcApi.onClaudeInfo((id: string, model?: string, context?: string) => {
    useTerminalStore.getState().setClaudeInfo(id, model, context)
  })

  unsubFocus = ipcApi.onNotificationFocusTerminal((terminalId: string) => {
    useTerminalStore.getState().setActiveTerminal(terminalId)
  })

  return () => {
    unsubStatus?.()
    unsubInfo?.()
    unsubFocus?.()
    unsubStatus = null
    unsubInfo = null
    unsubFocus = null
  }
}
