import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePtyIpc } from '../usePtyIpc'
import { useTerminalStore } from '../../store/terminal-store'

// The ipc-api module uses window.electronAPI which is mocked in setup.ts.
// We access the mock via window.electronAPI to control behavior per test.

describe('usePtyIpc', () => {
  let capturedExitCallback: ((id: string, exitCode: number) => void) | null
  let mockUnsubscribe: ReturnType<typeof vi.fn>

  beforeEach(() => {
    capturedExitCallback = null
    mockUnsubscribe = vi.fn()

    // Override onPtyExit to capture the callback
    ;(window.electronAPI.onPtyExit as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (id: string, exitCode: number) => void) => {
        capturedExitCallback = cb
        return mockUnsubscribe
      }
    )

    // Reset store
    useTerminalStore.setState({ terminals: {}, activeTerminalId: null })
  })

  it('subscribes to onPtyExit on mount', () => {
    renderHook(() => usePtyIpc())
    expect(window.electronAPI.onPtyExit).toHaveBeenCalledOnce()
  })

  it('calls setTerminalDead when PTY exits', () => {
    const id = useTerminalStore.getState().addTerminal()
    renderHook(() => usePtyIpc())

    capturedExitCallback!(id, 0)
    expect(useTerminalStore.getState().terminals[id].isAlive).toBe(false)
  })

  it('passes correct terminal ID to setTerminalDead', () => {
    const id1 = useTerminalStore.getState().addTerminal()
    const id2 = useTerminalStore.getState().addTerminal()
    renderHook(() => usePtyIpc())

    capturedExitCallback!(id1, 1)
    expect(useTerminalStore.getState().terminals[id1].isAlive).toBe(false)
    expect(useTerminalStore.getState().terminals[id2].isAlive).toBe(true)
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => usePtyIpc())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })

  it('handles multiple exit events independently', () => {
    const id1 = useTerminalStore.getState().addTerminal()
    const id2 = useTerminalStore.getState().addTerminal()
    renderHook(() => usePtyIpc())

    capturedExitCallback!(id1, 0)
    capturedExitCallback!(id2, 1)

    expect(useTerminalStore.getState().terminals[id1].isAlive).toBe(false)
    expect(useTerminalStore.getState().terminals[id2].isAlive).toBe(false)
  })
})
