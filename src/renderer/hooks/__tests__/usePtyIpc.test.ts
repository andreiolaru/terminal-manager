import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTerminalStore } from '../../store/terminal-store'
import { registerTerminal, unregisterTerminal, _resetForTesting } from '../../lib/pty-dispatcher'
import type { Terminal } from '@xterm/xterm'

function createMockTerminal(): Terminal {
  return { write: vi.fn() } as unknown as Terminal
}

describe('pty-dispatcher (centralized IPC routing)', () => {
  let capturedDataCallback: ((id: string, data: string) => void) | null
  let capturedExitCallback: ((id: string, exitCode: number) => void) | null
  let mockDataUnsub: ReturnType<typeof vi.fn>
  let mockExitUnsub: ReturnType<typeof vi.fn>

  beforeEach(() => {
    _resetForTesting()

    capturedDataCallback = null
    capturedExitCallback = null
    mockDataUnsub = vi.fn()
    mockExitUnsub = vi.fn()

    ;(window.electronAPI.onPtyData as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (id: string, data: string) => void) => {
        capturedDataCallback = cb
        return mockDataUnsub
      }
    )

    ;(window.electronAPI.onPtyExit as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (id: string, exitCode: number) => void) => {
        capturedExitCallback = cb
        return mockExitUnsub
      }
    )

    useTerminalStore.setState({
      terminals: {},
      groups: [],
      activeGroupId: null,
      nextTerminalNumber: 1,
      nextGroupNumber: 1
    })
  })

  afterEach(() => {
    _resetForTesting()
  })

  it('registers global listeners lazily on first terminal', () => {
    expect(window.electronAPI.onPtyData).not.toHaveBeenCalled()

    const terminal = createMockTerminal()
    registerTerminal('t1', terminal, vi.fn())

    expect(window.electronAPI.onPtyData).toHaveBeenCalledOnce()
    expect(window.electronAPI.onPtyExit).toHaveBeenCalledOnce()
  })

  it('routes data to correct terminal via O(1) Map lookup', () => {
    const t1 = createMockTerminal()
    const t2 = createMockTerminal()

    registerTerminal('t1', t1, vi.fn())
    registerTerminal('t2', t2, vi.fn())

    capturedDataCallback!('t1', 'hello')
    expect(t1.write).toHaveBeenCalledWith('hello')
    expect(t2.write).not.toHaveBeenCalled()

    capturedDataCallback!('t2', 'world')
    expect(t2.write).toHaveBeenCalledWith('world')
  })

  it('calls exit callback and setTerminalDead on PTY exit', () => {
    const id = useTerminalStore.getState().addTerminal()
    const exitCb = vi.fn()

    registerTerminal(id, createMockTerminal(), exitCb)
    capturedExitCallback!(id, 42)

    expect(exitCb).toHaveBeenCalledWith(42)
    expect(useTerminalStore.getState().terminals[id].isAlive).toBe(false)
  })

  it('cleans up global listeners when all terminals unregister', () => {
    registerTerminal('t1', createMockTerminal(), vi.fn())

    unregisterTerminal('t1')

    expect(mockDataUnsub).toHaveBeenCalledOnce()
    expect(mockExitUnsub).toHaveBeenCalledOnce()
  })

  it('handles exit for correct terminal among multiple', () => {
    const id1 = useTerminalStore.getState().addTerminal()
    const id2 = useTerminalStore.getState().addTerminal()
    const exitCb1 = vi.fn()
    const exitCb2 = vi.fn()

    registerTerminal(id1, createMockTerminal(), exitCb1)
    registerTerminal(id2, createMockTerminal(), exitCb2)

    capturedExitCallback!(id1, 0)

    expect(exitCb1).toHaveBeenCalledWith(0)
    expect(exitCb2).not.toHaveBeenCalled()
    expect(useTerminalStore.getState().terminals[id1].isAlive).toBe(false)
    expect(useTerminalStore.getState().terminals[id2].isAlive).toBe(true)
  })
})
