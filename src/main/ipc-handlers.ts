import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { existsSync } from 'fs'
import { PtyManager } from './pty-manager'
import { TemplateStorage } from './template-storage'
import { IPC_CHANNELS } from '../shared/ipc-types'
import type { PtyCreateOptions } from '../shared/ipc-types'
import type { LayoutTemplate } from '../shared/template-types'
import type { ClaudeCodeDetector } from './claude-detector'

const ALLOWED_SHELLS = new Set([
  'powershell.exe',
  'pwsh.exe',
  'cmd.exe',
  'bash.exe',
  'wsl.exe',
  'git-bash.exe'
])

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
      const shell = options.shell || 'powershell.exe'
      if (!ALLOWED_SHELLS.has(shell.toLowerCase())) {
        throw new Error(`Shell not allowed: ${shell}`)
      }
      const cwd = options.cwd || process.env.USERPROFILE || 'C:\\'
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
    }
  )

  ipcMain.on(IPC_CHANNELS.CLAUDE_REGISTER, (_, id: string) => {
    detector?.register(id)
  })

  ipcMain.on(IPC_CHANNELS.CLAUDE_UNREGISTER, (_, id: string) => {
    detector?.unregister(id)
  })

}
