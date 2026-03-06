import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// Mock window.electronAPI globally for all renderer tests
const electronAPI = {
  createPty: vi.fn(() => Promise.resolve()),
  writePty: vi.fn(),
  resizePty: vi.fn(),
  destroyPty: vi.fn(() => Promise.resolve()),
  onPtyData: vi.fn(() => vi.fn()),
  onPtyExit: vi.fn(() => vi.fn()),
  onShortcut: vi.fn(() => vi.fn()),
  setWindowTitle: vi.fn(),
  listTemplates: vi.fn(() => Promise.resolve([])),
  saveTemplates: vi.fn(() => Promise.resolve()),
  getTemplatesPath: vi.fn(() => Promise.resolve('')),
  registerClaude: vi.fn(),
  unregisterClaude: vi.fn(),
  onClaudeStatus: vi.fn(() => vi.fn()),
  onNotificationFocusTerminal: vi.fn(() => vi.fn()),
  setActiveTerminalForNotifications: vi.fn()
}

Object.defineProperty(window, 'electronAPI', {
  value: electronAPI,
  writable: true
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
