export interface ElectronAPI {
  createPty(options: {
    id: string
    shell?: string
    cwd?: string
    cols?: number
    rows?: number
  }): Promise<void>
  writePty(id: string, data: string): void
  resizePty(id: string, cols: number, rows: number): void
  destroyPty(id: string): Promise<void>
  onPtyData(callback: (id: string, data: string) => void): () => void
  onPtyExit(callback: (id: string, exitCode: number) => void): () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
