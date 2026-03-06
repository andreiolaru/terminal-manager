import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, SHORTCUT_NAMES } from '../shared/ipc-types'
import type { PtyCreateOptions, ShortcutName } from '../shared/ipc-types'

const shortcutWhitelist = new Set<string>(SHORTCUT_NAMES)

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
  },

  onShortcut(name: string, callback: () => void): () => void {
    if (!shortcutWhitelist.has(name)) {
      throw new Error(`Unknown shortcut: ${name}`)
    }
    const channel = `shortcut:${name}`
    const handler = (): void => { callback() }
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  setWindowTitle(title: string): void {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_TITLE, title)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
