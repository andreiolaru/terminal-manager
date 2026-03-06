import type { PtyCreateOptions } from '../shared/ipc-types'

export interface ElectronAPI {
  createPty(options: PtyCreateOptions): Promise<void>
  writePty(id: string, data: string): void
  resizePty(id: string, cols: number, rows: number): void
  destroyPty(id: string): Promise<void>
  onPtyData(callback: (id: string, data: string) => void): () => void
  onPtyExit(callback: (id: string, exitCode: number) => void): () => void
  onShortcut(name: string, callback: () => void): () => void
  setWindowTitle(title: string): void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
