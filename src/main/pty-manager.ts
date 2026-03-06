import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'

export class PtyManager {
  private ptys = new Map<string, pty.IPty>()
  private window: BrowserWindow | null = null

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  create(id: string, shell: string, cwd: string, cols: number, rows: number): void {
    // M18: Filter out undefined env values
    const env = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    )

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env
    })

    ptyProcess.onData((data) => {
      this.window?.webContents.send('pty:data', id, data)
    })

    // C6: Check map membership before sending exit — destroy() removes from map before kill()
    ptyProcess.onExit(({ exitCode }) => {
      if (!this.ptys.has(id)) return
      this.ptys.delete(id)
      this.window?.webContents.send('pty:exit', id, exitCode)
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
      // C6: Remove from map BEFORE kill so onExit handler is suppressed
      this.ptys.delete(id)
      p.kill()
    }
  }

  destroyAll(): void {
    // M12: Clear map first to suppress all onExit handlers
    const processes = [...this.ptys.values()]
    this.ptys.clear()
    for (const p of processes) {
      p.kill()
    }
  }
}
