import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import { PtyManager } from './pty-manager'
import { IPC_CHANNELS } from '../shared/ipc-types'
import type { PtyCreateOptions } from '../shared/ipc-types'

const ALLOWED_SHELLS = new Set([
  'powershell.exe',
  'pwsh.exe',
  'cmd.exe',
  'bash.exe',
  'wsl.exe',
  'git-bash.exe'
])

export function registerIpcHandlers(ptyManager: PtyManager): void {
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
}
