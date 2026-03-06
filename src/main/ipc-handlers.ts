import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import { PtyManager } from './pty-manager'

// C2: Allowlist of valid shells
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
    'pty:create',
    async (_, options: { id: string; shell?: string; cwd?: string; cols?: number; rows?: number }) => {
      const shell = options.shell || 'powershell.exe'
      if (!ALLOWED_SHELLS.has(shell)) {
        throw new Error(`Shell not allowed: ${shell}`)
      }
      const cwd = options.cwd || process.env.USERPROFILE || 'C:\\'
      if (!existsSync(cwd)) {
        throw new Error(`Working directory does not exist: ${cwd}`)
      }
      const cols = options.cols || 80
      const rows = options.rows || 24
      try {
        ptyManager.create(options.id, shell, cwd, cols, rows)
      } catch (err) {
        throw new Error(`Failed to spawn PTY: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  )

  ipcMain.on('pty:write', (_, id: string, data: string) => {
    ptyManager.write(id, data)
  })

  ipcMain.on('pty:resize', (_, id: string, cols: number, rows: number) => {
    ptyManager.resize(id, cols, rows)
  })

  ipcMain.handle('pty:destroy', async (_, id: string) => {
    ptyManager.destroy(id)
  })
}
