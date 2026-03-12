import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { WindowState, SessionData } from '../shared/session-types'

function isValidWindowState(data: unknown): data is WindowState {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return typeof d.width === 'number'
    && typeof d.height === 'number'
    && typeof d.x === 'number'
    && typeof d.y === 'number'
    && typeof d.isMaximized === 'boolean'
}

function isValidSessionData(data: unknown): data is SessionData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return typeof d.terminals === 'object' && d.terminals !== null
    && Array.isArray(d.groups)
    && typeof d.nextTerminalNumber === 'number'
    && typeof d.nextGroupNumber === 'number'
}

export class StateStorage {
  private dir: string
  private windowStatePath: string
  private sessionPath: string

  constructor() {
    this.dir = join(app.getPath('appData'), 'terminal-manager')
    this.windowStatePath = join(this.dir, 'window-state.json')
    this.sessionPath = join(this.dir, 'session.json')
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  loadWindowState(): WindowState | null {
    try {
      const raw = readFileSync(this.windowStatePath, 'utf-8')
      const parsed = JSON.parse(raw)
      return isValidWindowState(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  saveWindowState(state: WindowState): void {
    try {
      writeFileSync(this.windowStatePath, JSON.stringify(state, null, 2), 'utf-8')
    } catch {
      // Ignore write errors
    }
  }

  loadSession(): SessionData | null {
    try {
      const raw = readFileSync(this.sessionPath, 'utf-8')
      const parsed = JSON.parse(raw)
      return isValidSessionData(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  saveSession(data: SessionData): void {
    try {
      writeFileSync(this.sessionPath, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      // Ignore write errors
    }
  }
}
