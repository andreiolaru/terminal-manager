import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Mock xterm and addons before importing the component
const mockTerminal = {
  cols: 80,
  rows: 24,
  open: vi.fn(),
  write: vi.fn(),
  onData: vi.fn((_cb: (data: string) => void) => ({ dispose: vi.fn() })),
  onTitleChange: vi.fn((_cb: (title: string) => void) => ({ dispose: vi.fn() })),
  onFocus: vi.fn(() => ({ dispose: vi.fn() })),
  focus: vi.fn(),
  dispose: vi.fn(),
  loadAddon: vi.fn(),
  attachCustomKeyEventHandler: vi.fn()
}

vi.mock('@xterm/xterm', () => ({
  Terminal: class MockTerminal {
    cols = mockTerminal.cols
    rows = mockTerminal.rows
    open = mockTerminal.open
    write = mockTerminal.write
    onData = mockTerminal.onData
    onTitleChange = mockTerminal.onTitleChange
    onFocus = mockTerminal.onFocus
    focus = mockTerminal.focus
    dispose = mockTerminal.dispose
    loadAddon = mockTerminal.loadAddon
    attachCustomKeyEventHandler = mockTerminal.attachCustomKeyEventHandler
  }
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = vi.fn()
  }
}))

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class MockWebglAddon {}
}))

// Mock the CSS imports
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))
vi.mock('../../../assets/styles/terminal.css', () => ({}))

import TerminalInstance from '../TerminalInstance'

describe('TerminalInstance', () => {
  let capturedDataCallback: ((id: string, data: string) => void) | null
  let capturedExitCallback: ((id: string, exitCode: number) => void) | null
  let mockDataUnsub: ReturnType<typeof vi.fn>
  let mockExitUnsub: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    capturedDataCallback = null
    capturedExitCallback = null
    mockDataUnsub = vi.fn()
    mockExitUnsub = vi.fn()

    // Reset mockTerminal callbacks
    mockTerminal.onData.mockReturnValue({ dispose: vi.fn() })

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
  })

  it('calls createPty on mount with correct args', () => {
    render(<TerminalInstance terminalId="t1" isVisible={true} isActive={true} />)
    expect(window.electronAPI.createPty).toHaveBeenCalledWith({
      id: 't1',
      cols: 80,
      rows: 24
    })
  })

  it('subscribes to onPtyData on mount', () => {
    render(<TerminalInstance terminalId="t1" isVisible={true} isActive={true} />)
    expect(window.electronAPI.onPtyData).toHaveBeenCalled()
  })

  it('routes PTY data to the correct terminal', () => {
    render(<TerminalInstance terminalId="t1" isVisible={true} isActive={true} />)
    capturedDataCallback!('t1', 'hello')
    expect(mockTerminal.write).toHaveBeenCalledWith('hello')
  })

  it('ignores PTY data for other terminal IDs', () => {
    render(<TerminalInstance terminalId="t1" isVisible={true} isActive={true} />)
    capturedDataCallback!('other-id', 'nope')
    expect(mockTerminal.write).not.toHaveBeenCalled()
  })

  it('forwards user input to writePty', () => {
    let userInputCb: ((data: string) => void) | null = null
    mockTerminal.onData.mockImplementation(
      (cb: (data: string) => void) => {
        userInputCb = cb
        return { dispose: vi.fn() }
      }
    )

    render(<TerminalInstance terminalId="t1" isVisible={true} isActive={true} />)
    userInputCb!('typed text')
    expect(window.electronAPI.writePty).toHaveBeenCalledWith(
      't1',
      'typed text'
    )
  })

  it('calls destroyPty and disposes subscriptions on unmount', () => {
    const { unmount } = render(
      <TerminalInstance terminalId="t1" isVisible={true} isActive={true} />
    )
    unmount()

    expect(window.electronAPI.destroyPty).toHaveBeenCalledWith('t1')
    expect(mockDataUnsub).toHaveBeenCalled()
    expect(mockExitUnsub).toHaveBeenCalled()
    expect(mockTerminal.dispose).toHaveBeenCalled()
  })

  it('hides terminal with display:none when isVisible=false', () => {
    const { container } = render(
      <TerminalInstance terminalId="t1" isVisible={false} isActive={false} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.display).toBe('none')
  })

  it('shows terminal with display:block when isVisible=true', () => {
    const { container } = render(
      <TerminalInstance terminalId="t1" isVisible={true} isActive={true} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.display).toBe('block')
  })

  it('writes exit message when PTY exits for this terminal', () => {
    render(<TerminalInstance terminalId="t1" isVisible={true} isActive={true} />)
    capturedExitCallback!('t1', 42)
    expect(mockTerminal.write).toHaveBeenCalledWith(
      expect.stringContaining('Process exited with code 42')
    )
  })

  it('ignores PTY exit for other terminal IDs', () => {
    render(<TerminalInstance terminalId="t1" isVisible={true} isActive={true} />)
    capturedExitCallback!('other-id', 1)
    expect(mockTerminal.write).not.toHaveBeenCalled()
  })
})
