import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// Mock node-pty
const mockPtyEmitter = () => {
  const emitter = new EventEmitter()
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: (cb: (data: string) => void) => {
      emitter.on('data', cb)
      return { dispose: () => emitter.removeListener('data', cb) }
    },
    onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => {
      emitter.on('exit', cb)
      return { dispose: () => emitter.removeListener('exit', cb) }
    },
    _emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args)
  }
}

type MockPty = ReturnType<typeof mockPtyEmitter>

let lastSpawnedPty: MockPty

vi.mock('node-pty', () => ({
  spawn: vi.fn((..._args: unknown[]) => {
    lastSpawnedPty = mockPtyEmitter()
    return lastSpawnedPty
  })
}))

vi.mock('electron', () => ({
  BrowserWindow: vi.fn()
}))

import { PtyManager } from '../pty-manager'
import * as pty from 'node-pty'

describe('PtyManager', () => {
  let manager: PtyManager
  let mockSend: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new PtyManager()
    mockSend = vi.fn()
    manager.setWindow({
      webContents: { send: mockSend }
    } as unknown as import('electron').BrowserWindow)
  })

  describe('create', () => {
    it('spawns a PTY with correct arguments', () => {
      manager.create('t1', 'powershell.exe', 'C:\\Users', 120, 30)

      expect(pty.spawn).toHaveBeenCalledWith('powershell.exe', [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: 'C:\\Users',
        env: expect.any(Object)
      })
    })

    it('stores PTY in internal map (write works after create)', () => {
      manager.create('t1', 'sh', '/tmp', 80, 24)
      manager.write('t1', 'hello')
      expect(lastSpawnedPty.write).toHaveBeenCalledWith('hello')
    })

    it('sends pty:data IPC on PTY data event', () => {
      manager.create('t1', 'sh', '/tmp', 80, 24)
      const ptyRef = lastSpawnedPty
      ptyRef._emit('data', 'output text')

      expect(mockSend).toHaveBeenCalledWith('pty:data', 't1', 'output text')
    })

    it('sends pty:exit IPC and cleans up map on PTY exit', () => {
      manager.create('t1', 'sh', '/tmp', 80, 24)
      const ptyRef = lastSpawnedPty
      ptyRef._emit('exit', { exitCode: 0 })

      expect(mockSend).toHaveBeenCalledWith('pty:exit', 't1', 0)
      // After exit, write should be no-op (PTY removed from map)
      manager.write('t1', 'data')
      expect(ptyRef.write).not.toHaveBeenCalled()
    })
  })

  describe('write', () => {
    it('calls pty.write with correct data', () => {
      manager.create('t1', 'sh', '/tmp', 80, 24)
      manager.write('t1', 'ls\n')
      expect(lastSpawnedPty.write).toHaveBeenCalledWith('ls\n')
    })

    it('is a no-op for non-existent ID', () => {
      expect(() => manager.write('non-existent', 'data')).not.toThrow()
    })
  })

  describe('resize', () => {
    it('calls pty.resize with correct cols/rows', () => {
      manager.create('t1', 'sh', '/tmp', 80, 24)
      manager.resize('t1', 120, 40)
      expect(lastSpawnedPty.resize).toHaveBeenCalledWith(120, 40)
    })

    it('is a no-op for non-existent ID', () => {
      expect(() => manager.resize('non-existent', 80, 24)).not.toThrow()
    })
  })

  describe('destroy', () => {
    it('calls pty.kill and removes from map', () => {
      manager.create('t1', 'sh', '/tmp', 80, 24)
      const ptyRef = lastSpawnedPty
      manager.destroy('t1')

      expect(ptyRef.kill).toHaveBeenCalled()
      // Subsequent write should be no-op
      manager.write('t1', 'data')
      expect(ptyRef.write).not.toHaveBeenCalled()
    })

    it('is a no-op for non-existent ID', () => {
      expect(() => manager.destroy('non-existent')).not.toThrow()
    })
  })

  describe('destroy then re-create same ID (split race)', () => {
    it('old PTY exit does not kill the new PTY', () => {
      manager.create('t1', 'sh', '/tmp', 80, 24)
      const oldPty = lastSpawnedPty

      // Destroy old PTY (simulates TerminalInstance unmount cleanup)
      manager.destroy('t1')
      expect(oldPty.kill).toHaveBeenCalled()

      // Re-create with same ID (simulates TerminalInstance remount after split)
      manager.create('t1', 'sh', '/tmp', 80, 24)
      const newPty = lastSpawnedPty

      // Old PTY's onExit fires late (async kill completion)
      oldPty._emit('exit', { exitCode: 0 })

      // The exit should NOT have removed the new PTY from the map
      manager.write('t1', 'hello')
      expect(newPty.write).toHaveBeenCalledWith('hello')

      // Should NOT have sent pty:exit for the re-created terminal
      expect(mockSend).not.toHaveBeenCalledWith('pty:exit', 't1', 0)
    })
  })

  describe('destroyAll', () => {
    it('kills all PTYs and clears map', () => {
      manager.create('t1', 'sh', '/tmp', 80, 24)
      const pty1 = lastSpawnedPty
      manager.create('t2', 'sh', '/tmp', 80, 24)
      const pty2 = lastSpawnedPty

      manager.destroyAll()

      expect(pty1.kill).toHaveBeenCalled()
      expect(pty2.kill).toHaveBeenCalled()
      // Both should be removed
      manager.write('t1', 'data')
      manager.write('t2', 'data')
      expect(pty1.write).not.toHaveBeenCalled()
      expect(pty2.write).not.toHaveBeenCalled()
    })

    it('is a no-op with empty map', () => {
      expect(() => manager.destroyAll()).not.toThrow()
    })
  })
})
