import { ipcMain } from 'electron'
import { PtyManager } from './pty-manager'

export function registerIpcHandlers(ptyManager: PtyManager): void {
  ipcMain.handle(
    'pty:create',
    async (_, options: { id: string; shell?: string; cwd?: string; cols?: number; rows?: number }) => {
      const shell = options.shell || 'powershell.exe'
      const cwd = options.cwd || process.env.USERPROFILE || 'C:\\'
      const cols = options.cols || 80
      const rows = options.rows || 24
      ptyManager.create(options.id, shell, cwd, cols, rows)
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
