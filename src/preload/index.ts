import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, SHORTCUT_NAMES } from '../shared/ipc-types'
import type { PtyCreateOptions, ShortcutName } from '../shared/ipc-types'
import type { LayoutTemplate } from '../shared/template-types'

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
  },

  listTemplates(): Promise<LayoutTemplate[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.TEMPLATES_LIST)
  },

  saveTemplates(templates: LayoutTemplate[]): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.TEMPLATES_SAVE, templates)
  },

  getTemplatesPath(): Promise<string> {
    return ipcRenderer.invoke(IPC_CHANNELS.TEMPLATES_GET_PATH)
  },

  showTemplatesInFolder(): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.TEMPLATES_SHOW_IN_FOLDER)
  },

  registerClaude(id: string): void {
    ipcRenderer.send(IPC_CHANNELS.CLAUDE_REGISTER, id)
  },

  unregisterClaude(id: string): void {
    ipcRenderer.send(IPC_CHANNELS.CLAUDE_UNREGISTER, id)
  },

  onClaudeStatus(callback: (id: string, status: string, contextTitle?: string) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, id: string, status: string, contextTitle?: string): void => {
      callback(id, status, contextTitle)
    }
    ipcRenderer.on(IPC_CHANNELS.CLAUDE_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_STATUS, handler)
  },

  onNotificationFocusTerminal(callback: (id: string) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, id: string): void => {
      callback(id)
    }
    ipcRenderer.on(IPC_CHANNELS.NOTIFICATION_FOCUS_TERMINAL, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.NOTIFICATION_FOCUS_TERMINAL, handler)
  },

  setActiveTerminalForNotifications(id: string | null): void {
    ipcRenderer.send(IPC_CHANNELS.NOTIFICATION_ACTIVE_TERMINAL, id)
  },

  confirmClose(title: string, message: string, detail: string): Promise<boolean> {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIRM_CLOSE, title, message, detail)
  },

  onAppCloseRequested(callback: () => void): () => void {
    const handler = (): void => { callback() }
    ipcRenderer.on(IPC_CHANNELS.APP_CLOSE_REQUESTED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_CLOSE_REQUESTED, handler)
  },

  confirmAppClose(): void {
    ipcRenderer.send(IPC_CHANNELS.APP_CLOSE_CONFIRMED)
  },

  cancelAppClose(): void {
    ipcRenderer.send(IPC_CHANNELS.APP_CLOSE_CANCELLED)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
