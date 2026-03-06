import type { PtyCreateOptions } from '../shared/ipc-types'
import type { LayoutTemplate } from '../shared/template-types'

export interface ElectronAPI {
  createPty(options: PtyCreateOptions): Promise<void>
  writePty(id: string, data: string): void
  resizePty(id: string, cols: number, rows: number): void
  destroyPty(id: string): Promise<void>
  onPtyData(callback: (id: string, data: string) => void): () => void
  onPtyExit(callback: (id: string, exitCode: number) => void): () => void
  onShortcut(name: string, callback: () => void): () => void
  setWindowTitle(title: string): void
  listTemplates(): Promise<LayoutTemplate[]>
  saveTemplates(templates: LayoutTemplate[]): Promise<void>
  getTemplatesPath(): Promise<string>
  showTemplatesInFolder(): Promise<void>
  registerClaude(id: string): void
  unregisterClaude(id: string): void
  onClaudeStatus(callback: (id: string, status: string, contextTitle?: string) => void): () => void
  onNotificationFocusTerminal(callback: (id: string) => void): () => void
  setActiveTerminalForNotifications(id: string | null): void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
