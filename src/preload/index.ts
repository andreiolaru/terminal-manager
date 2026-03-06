import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  createPty(options: {
    id: string
    shell?: string
    cwd?: string
    cols?: number
    rows?: number
  }): Promise<void> {
    return ipcRenderer.invoke('pty:create', options)
  },

  writePty(id: string, data: string): void {
    ipcRenderer.send('pty:write', id, data)
  },

  resizePty(id: string, cols: number, rows: number): void {
    ipcRenderer.send('pty:resize', id, cols, rows)
  },

  destroyPty(id: string): Promise<void> {
    return ipcRenderer.invoke('pty:destroy', id)
  },

  onPtyData(callback: (id: string, data: string) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, id: string, data: string): void => {
      callback(id, data)
    }
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.removeListener('pty:data', handler)
  },

  onPtyExit(callback: (id: string, exitCode: number) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, id: string, exitCode: number): void => {
      callback(id, exitCode)
    }
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.removeListener('pty:exit', handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
