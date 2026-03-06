import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-types'
import type { PtyCreateOptions } from '../shared/ipc-types'

const electronAPI = {
  createPty(options: PtyCreateOptions): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.PTY_CREATE, options)
  },

  writePty(id: string, data: string): void {
    ipcRenderer.send(IPC_CHANNELS.PTY_WRITE, id, data)
  },

  resizePty(id: string, cols: number, rows: number): void {
    ipcRenderer.send(IPC_CHANNELS.PTY_RESIZE, id, cols, rows)
  },

  destroyPty(id: string): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.PTY_DESTROY, id)
  },

  onPtyData(callback: (id: string, data: string) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, id: string, data: string): void => {
      callback(id, data)
    }
    ipcRenderer.on(IPC_CHANNELS.PTY_DATA, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PTY_DATA, handler)
  },

  onPtyExit(callback: (id: string, exitCode: number) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, id: string, exitCode: number): void => {
      callback(id, exitCode)
    }
    ipcRenderer.on(IPC_CHANNELS.PTY_EXIT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PTY_EXIT, handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
