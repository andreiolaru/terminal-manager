import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { existsSync } from 'fs'
import { PtyManager } from './pty-manager'
import { TemplateStorage } from './template-storage'
import { IPC_CHANNELS } from '../shared/ipc-types'
import type { PtyCreateOptions } from '../shared/ipc-types'
import type { LayoutTemplate } from '../shared/template-types'
import type { ClaudeCodeDetector } from './claude-detector'

const ALLOWED_SHELLS_WIN = new Set([
  'powershell.exe',
  'pwsh.exe',
  'cmd.exe',
  'bash.exe',
  'wsl.exe',
  'git-bash.exe'
])

const ALLOWED_SHELLS_POSIX = new Set([
  '/bin/bash',
  '/bin/zsh',
  '/bin/sh',
  '/usr/bin/bash',
  '/usr/bin/zsh',
  '/usr/local/bin/bash',
  '/usr/local/bin/zsh',
  '/usr/local/bin/fish',
  '/opt/homebrew/bin/bash',
  '/opt/homebrew/bin/zsh',
  '/opt/homebrew/bin/fish',
  'bash',
  'zsh',
  'sh',
  'fish'
])

function isShellAllowed(shell: string): boolean {
  if (process.platform === 'win32') {
    return ALLOWED_SHELLS_WIN.has(shell.toLowerCase())
  }
  return ALLOWED_SHELLS_POSIX.has(shell)
}

let templateStorage: TemplateStorage | null = null
function getTemplateStorage(): TemplateStorage {
  if (!templateStorage) templateStorage = new TemplateStorage()
  return templateStorage
}

export function registerIpcHandlers(
  ptyManager: PtyManager,
  detector?: ClaudeCodeDetector
): void {
  ipcMain.handle(
    IPC_CHANNELS.PTY_CREATE,
    async (_, options: PtyCreateOptions) => {
      const defaultShell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/zsh')
      const shell = options.shell || defaultShell
      if (!isShellAllowed(shell)) {
        throw new Error(`Shell not allowed: ${shell}`)
      }
      const homeDir = process.env.HOME || process.env.USERPROFILE || (process.platform === 'win32' ? 'C:\\' : '/')
      const cwd = options.cwd || homeDir
      if (!existsSync(cwd)) {
        throw new Error(`Working directory does not exist: ${cwd}`)
      }
      const rawCols = options.cols ?? 80
      const rawRows = options.rows ?? 24
      const cols = Number.isFinite(rawCols) && rawCols > 0 ? Math.floor(rawCols) : 80
      const rows = Number.isFinite(rawRows) && rawRows > 0 ? Math.floor(rawRows) : 24
      try {
        ptyManager.create(options.id, shell, cwd, cols, rows)
      } catch (err) {
        throw new Error(`Failed to spawn PTY: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  )

  ipcMain.on(IPC_CHANNELS.PTY_WRITE, (_, id: string, data: string) => {
    ptyManager.write(id, data)
  })

  ipcMain.on(IPC_CHANNELS.PTY_RESIZE, (_, id: string, cols: number, rows: number) => {
    const safeCols = Number.isFinite(cols) && cols > 0 ? Math.floor(cols) : 80
    const safeRows = Number.isFinite(rows) && rows > 0 ? Math.floor(rows) : 24
    ptyManager.resize(id, safeCols, safeRows)
  })

  ipcMain.handle(IPC_CHANNELS.PTY_DESTROY, async (_, id: string) => {
    ptyManager.destroy(id)
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_SET_TITLE, (event, title: string) => {
    BrowserWindow.fromWebContents(event.sender)?.setTitle(title)
  })

  ipcMain.handle(IPC_CHANNELS.TEMPLATES_LIST, async () => {
    return getTemplateStorage().list()
  })

  ipcMain.handle(IPC_CHANNELS.TEMPLATES_SAVE, async (_, templates: LayoutTemplate[]) => {
    getTemplateStorage().save(templates)
  })

  ipcMain.handle(IPC_CHANNELS.TEMPLATES_GET_PATH, async () => {
    return getTemplateStorage().getPath()
  })

  ipcMain.handle(IPC_CHANNELS.TEMPLATES_SHOW_IN_FOLDER, async () => {
    shell.showItemInFolder(getTemplateStorage().getPath())
  })

  ipcMain.handle(
    IPC_CHANNELS.CONFIRM_CLOSE,
    async (event, title: string, message: string, detail: string): Promise<boolean> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return true
      win.setAlwaysOnTop(true)
      try {
        const { response } = await dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['Force Close', 'Cancel'],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
          title,
          message,
          detail,
        })
        return response === 0
      } finally {
        win.setAlwaysOnTop(false)
      }
    }
  )

  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_MENU_ACTION, (event, action: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (action.startsWith('shortcut:')) {
      win.webContents.send(action)
      return
    }
    switch (action) {
      case 'zoom-in': win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5); break
      case 'zoom-out': win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5); break
      case 'zoom-reset': win.webContents.setZoomLevel(0); break
      case 'toggle-devtools': win.webContents.toggleDevTools(); break
      case 'about':
        win.setAlwaysOnTop(true)
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'About Terminal Manager',
          message: 'Terminal Manager',
          detail: 'A VS Code-style integrated terminal manager.\nBuilt with Electron + React + xterm.js.\nBy Andrei Olaru',
        }).finally(() => win.setAlwaysOnTop(false))
        break
    }
  })

  ipcMain.on(IPC_CHANNELS.CLAUDE_REGISTER, (_, id: string) => {
    detector?.register(id)
  })

  ipcMain.on(IPC_CHANNELS.CLAUDE_UNREGISTER, (_, id: string) => {
    detector?.unregister(id)
  })

}
