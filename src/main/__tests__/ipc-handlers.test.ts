import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
}))

vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}))

import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import { registerIpcHandlers } from '../ipc-handlers'

const mockHandle = vi.mocked(ipcMain.handle)
const mockOn = vi.mocked(ipcMain.on)
const mockExistsSync = vi.mocked(existsSync)

type AsyncHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>
type SyncHandler = (event: unknown, ...args: unknown[]) => void

function getHandleHandler(channel: string): AsyncHandler {
  const call = mockHandle.mock.calls.find((c) => c[0] === channel)
  if (!call) throw new Error(`No handle() registered for ${channel}`)
  return call[1] as AsyncHandler
}

function getOnHandler(channel: string): SyncHandler {
  const call = mockOn.mock.calls.find((c) => c[0] === channel)
  if (!call) throw new Error(`No on() registered for ${channel}`)
  return call[1] as SyncHandler
}

describe('ipc-handlers', () => {
  const mockPtyManager = {
    create: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
  }

  let createHandler: AsyncHandler
  let resizeHandler: SyncHandler

  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(true)
    registerIpcHandlers(mockPtyManager as never)
    createHandler = getHandleHandler('pty:create')
    resizeHandler = getOnHandler('pty:resize')
  })

  describe('shell allowlist (M11 — case-insensitive)', () => {
    it('accepts lowercase shell', async () => {
      await createHandler({}, { id: 't1', shell: 'powershell.exe', cwd: 'C:\\' })
      expect(mockPtyManager.create).toHaveBeenCalled()
    })

    it('accepts mixed-case shell', async () => {
      await createHandler({}, { id: 't1', shell: 'PowerShell.Exe', cwd: 'C:\\' })
      expect(mockPtyManager.create).toHaveBeenCalled()
    })

    it('accepts uppercase shell', async () => {
      await createHandler({}, { id: 't1', shell: 'CMD.EXE', cwd: 'C:\\' })
      expect(mockPtyManager.create).toHaveBeenCalled()
    })

    it('rejects unknown shell', async () => {
      await expect(
        createHandler({}, { id: 't1', shell: 'evil.exe', cwd: 'C:\\' })
      ).rejects.toThrow('Shell not allowed')
    })

    it('rejects path-traversal shell name', async () => {
      await expect(
        createHandler({}, { id: 't1', shell: '../../../etc/evil.exe', cwd: 'C:\\' })
      ).rejects.toThrow('Shell not allowed')
    })
  })

  describe('cols/rows validation (M17)', () => {
    it('falls back to defaults for zero dimensions', async () => {
      await createHandler({}, { id: 't1', cwd: 'C:\\', cols: 0, rows: 0 })
      expect(mockPtyManager.create).toHaveBeenCalledWith('t1', 'powershell.exe', 'C:\\', 80, 24)
    })

    it('falls back to defaults for negative dimensions', async () => {
      await createHandler({}, { id: 't1', cwd: 'C:\\', cols: -10, rows: -5 })
      expect(mockPtyManager.create).toHaveBeenCalledWith('t1', 'powershell.exe', 'C:\\', 80, 24)
    })

    it('falls back to defaults for NaN dimensions', async () => {
      await createHandler({}, { id: 't1', cwd: 'C:\\', cols: NaN, rows: NaN })
      expect(mockPtyManager.create).toHaveBeenCalledWith('t1', 'powershell.exe', 'C:\\', 80, 24)
    })

    it('floors fractional dimensions', async () => {
      await createHandler({}, { id: 't1', cwd: 'C:\\', cols: 120.7, rows: 40.3 })
      expect(mockPtyManager.create).toHaveBeenCalledWith('t1', 'powershell.exe', 'C:\\', 120, 40)
    })

    it('passes valid integer dimensions unchanged', async () => {
      await createHandler({}, { id: 't1', cwd: 'C:\\', cols: 120, rows: 40 })
      expect(mockPtyManager.create).toHaveBeenCalledWith('t1', 'powershell.exe', 'C:\\', 120, 40)
    })
  })

  describe('pty:resize validation', () => {
    it('clamps zero/negative to defaults', () => {
      resizeHandler({}, 't1', 0, -1)
      expect(mockPtyManager.resize).toHaveBeenCalledWith('t1', 80, 24)
    })

    it('clamps NaN to defaults', () => {
      resizeHandler({}, 't1', NaN, NaN)
      expect(mockPtyManager.resize).toHaveBeenCalledWith('t1', 80, 24)
    })

    it('floors fractional dimensions', () => {
      resizeHandler({}, 't1', 120.9, 40.1)
      expect(mockPtyManager.resize).toHaveBeenCalledWith('t1', 120, 40)
    })

    it('passes valid dimensions unchanged', () => {
      resizeHandler({}, 't1', 100, 30)
      expect(mockPtyManager.resize).toHaveBeenCalledWith('t1', 100, 30)
    })
  })

  describe('cwd validation', () => {
    it('rejects non-existent cwd', async () => {
      mockExistsSync.mockReturnValue(false)
      await expect(
        createHandler({}, { id: 't1', cwd: 'C:\\NonExistent' })
      ).rejects.toThrow('Working directory does not exist')
    })
  })
})
