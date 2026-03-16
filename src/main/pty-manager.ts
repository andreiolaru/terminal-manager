import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import type { ClaudeCodeDetector } from './claude-detector'
import { extractOscSignals } from './claude-detector'
import { IPC_CHANNELS } from '../shared/ipc-types'

// OSC title patterns that indicate Claude Code is running
const CLAUDE_TITLE_PATTERN = /^[\u273B*]|claude/i

export class PtyManager {
  private ptys = new Map<string, pty.IPty>()
  private window: BrowserWindow | null = null
  private detector: ClaudeCodeDetector | null = null

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  setDetector(detector: ClaudeCodeDetector): void {
    this.detector = detector
  }

  create(id: string, shell: string, cwd: string, cols: number, rows: number): void {
    // Kill any existing PTY with the same ID (e.g., after HMR renderer reload)
    const existing = this.ptys.get(id)
    if (existing) {
      this.ptys.delete(id)
      existing.kill()
    }

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
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('pty:data', id, data)
      }
      // Auto-register with Claude detector if we see Claude Code's OSC title
      if (this.detector && !this.detector.isRegistered(id)) {
        const osc = extractOscSignals(data)
        if (osc.title && CLAUDE_TITLE_PATTERN.test(osc.title)) {
          this.detector.register(id)
          if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send(IPC_CHANNELS.CLAUDE_STATUS, id, 'idle')
          }
        }
      }
      this.detector?.feed(id, data)
    })

    // Only handle exit if this ptyProcess is still the active one for this ID.
    // After destroy(), the map entry is already deleted so get() returns undefined !== ptyProcess.
    // After a split re-creates the same ID, get() returns the NEW process !== this old one.
    ptyProcess.onExit(({ exitCode }) => {
      if (this.ptys.get(id) !== ptyProcess) return
      this.ptys.delete(id)
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('pty:exit', id, exitCode)
      }
    })

    this.ptys.set(id, ptyProcess)
  }

  write(id: string, data: string): void {
    this.ptys.get(id)?.write(data)
    this.detector?.onWrite(id)
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
