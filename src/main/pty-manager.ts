import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'

export class PtyManager {
  private ptys = new Map<string, pty.IPty>()
  private window: BrowserWindow | null = null

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  create(id: string, shell: string, cwd: string, cols: number, rows: number): void {
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>
    })

    ptyProcess.onData((data) => {
      this.window?.webContents.send('pty:data', id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.window?.webContents.send('pty:exit', id, exitCode)
      this.ptys.delete(id)
    })

    this.ptys.set(id, ptyProcess)
  }

  write(id: string, data: string): void {
    this.ptys.get(id)?.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.ptys.get(id)?.resize(cols, rows)
  }

  destroy(id: string): void {
    const p = this.ptys.get(id)
    if (p) {
      p.kill()
      this.ptys.delete(id)
    }
  }

  destroyAll(): void {
    for (const [, p] of this.ptys) {
      p.kill()
    }
    this.ptys.clear()
  }
}
