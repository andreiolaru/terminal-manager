import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { SerializeAddon } from '@xterm/addon-serialize'
import { ipcApi } from '../../lib/ipc-api'
import { registerTerminal, unregisterTerminal, registerFirstDataCallback } from '../../lib/pty-dispatcher'
import { useTerminalStore } from '../../store/terminal-store'
import { defaultConfig } from '../../lib/config'
import { RESIZE_DEBOUNCE_MS } from '../../lib/constants'
import '@xterm/xterm/css/xterm.css'
import '../../assets/styles/terminal.css'

export interface TerminalInstanceHandle {
  focus: () => void
}

interface TerminalInstanceProps {
  terminalId: string
  isVisible: boolean
  isActive: boolean
}

// Persists terminal instances across unmount/remount cycles during split operations.
// When a split changes the React tree structure, the old component unmounts and a new one
// mounts for the same terminalId. This map preserves the xterm + PTY session across that gap.
const persistedTerminals = new Map<string, {
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  serializeAddon: SerializeAddon
}>()

import { searchAddonRegistry } from '../../lib/search-registry'
import { serializeAddonRegistry } from '../../lib/serialize-registry'
import { pendingScrollback } from '../../lib/pending-scrollback'
import { registerFileLinkProvider } from '../../lib/file-link-provider'

/** Copy selection with soft-wrapped lines joined into single logical lines. */
function getCleanSelection(terminal: Terminal): string {
  const sel = terminal.getSelectionPosition()
  if (!sel) return terminal.getSelection()

  const buffer = terminal.buffer.active
  const lines: string[] = []

  for (let row = sel.start.y; row <= sel.end.y; row++) {
    const line = buffer.getLine(row)
    if (!line) continue

    const startCol = row === sel.start.y ? sel.start.x : 0
    const endCol = row === sel.end.y ? sel.end.x : terminal.cols

    let text = ''
    for (let col = startCol; col < endCol; col++) {
      const cell = line.getCell(col)
      if (cell) text += cell.getChars() || ' '
    }

    // Wrapped lines are continuations — append without newline
    if (line.isWrapped && lines.length > 0) {
      lines[lines.length - 1] += text
    } else {
      lines.push(text)
    }
  }

  return lines.map((l) => l.trimEnd()).join('\n')
}

function pasteWithWarning(terminal: Terminal): void {
  const text = window.electronAPI.clipboardReadText()
  if (!text) return
  const lines = text.split('\n')
  if (lines.length > 2 || (lines.length === 2 && lines[1].trim() !== '')) {
    if (!window.confirm(`You are about to paste ${lines.length} lines. Continue?`)) return
  }
  terminal.paste(text)
}

function useResolvedFontSize(terminalId: string): number {
  return useTerminalStore((s) => {
    const term = s.terminals[terminalId]
    if (term?.fontSize) return term.fontSize
    const group = s.groups.find((g) =>
      g.splitTree.type === 'leaf'
        ? g.splitTree.terminalId === terminalId
        : JSON.stringify(g.splitTree).includes(terminalId)
    )
    if (group?.fontSize) return group.fontSize
    return s.globalFontSize
  })
}

const TerminalInstance = forwardRef<TerminalInstanceHandle, TerminalInstanceProps>(function TerminalInstance({ terminalId, isVisible, isActive }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => terminalRef.current?.focus()
  }), [])
  const visibleRef = useRef(isVisible)
  visibleRef.current = isVisible
  const resolvedFontSize = useResolvedFontSize(terminalId)

  useEffect(() => {
    if (!containerRef.current) return

    const persisted = persistedTerminals.get(terminalId)
    let terminal: Terminal
    let fitAddon: FitAddon
    let searchAddon: SearchAddon
    let serializeAddon: SerializeAddon
    let isReattach = false

    if (persisted) {
      // Reattach existing terminal — preserves PTY session and scrollback
      terminal = persisted.terminal
      fitAddon = persisted.fitAddon
      searchAddon = persisted.searchAddon
      serializeAddon = persisted.serializeAddon
      searchAddonRegistry.set(terminalId, searchAddon)
      serializeAddonRegistry.set(terminalId, serializeAddon)
      persistedTerminals.delete(terminalId)
      isReattach = true

      // Move the xterm DOM element into the new container
      if (terminal.element) {
        containerRef.current.appendChild(terminal.element)
      }
    } else {
      // Create new terminal instance
      terminal = new Terminal({
        cursorBlink: true,
        fontSize: defaultConfig.font.size,
        fontFamily: defaultConfig.font.family,
        theme: {
          background: defaultConfig.theme.background,
          foreground: defaultConfig.theme.foreground,
          cursor: defaultConfig.theme.cursor,
          selectionBackground: defaultConfig.theme.selectionBackground
        },
        scrollback: defaultConfig.scrollback,
        allowProposedApi: true
      })

      fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)

      // Search — exposed via searchAddonRegistry for SearchBar component
      searchAddon = new SearchAddon()
      terminal.loadAddon(searchAddon)
      searchAddonRegistry.set(terminalId, searchAddon)

      // Serialize — exposed via serializeAddonRegistry for session save
      serializeAddon = new SerializeAddon()
      terminal.loadAddon(serializeAddon)
      serializeAddonRegistry.set(terminalId, serializeAddon)

      // Restore scrollback BEFORE open() to avoid rendering intermediate frames
      const savedScrollback = pendingScrollback.get(terminalId)
      if (savedScrollback) {
        terminal.write(savedScrollback)
        pendingScrollback.delete(terminalId)
      }

      terminal.attachCustomKeyEventHandler((e) => {
        // Let Electron menu accelerators handle these combos
        if (e.type !== 'keydown') return true

        // Ctrl+Delete: delete word forward (send escape sequence to shell)
        if (e.ctrlKey && !e.shiftKey && e.key === 'Delete') {
          terminal.input('\x1b[3;5~')
          return false
        }

        // Ctrl+V / Ctrl+Shift+V: paste with multi-line warning
        if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
          pasteWithWarning(terminal)
          return false
        }

        // Ctrl+C copies selected text instead of sending SIGINT when there's a selection
        if (e.ctrlKey && !e.shiftKey && e.key === 'c' && terminal.hasSelection()) {
          window.electronAPI.clipboardWriteText(getCleanSelection(terminal))
          terminal.clearSelection()
          return false
        }

        if (e.ctrlKey && e.shiftKey && ['T', 'W', 'D', 'E', 'B', 'F'].includes(e.key)) return false
        if (e.ctrlKey && !e.shiftKey && e.key === 'b') return false
        if (e.ctrlKey && e.key === 'Tab') return false
        if (e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return false
        return true
      })

      terminal.open(containerRef.current)

      try {
        const webgl = new WebglAddon()
        webgl.onContextLoss(() => {
          webgl.dispose()
          console.warn('WebGL context lost, falling back to canvas renderer')
        })
        terminal.loadAddon(webgl)
      } catch {
        console.warn('WebGL addon failed to load, using canvas renderer')
      }

      // Unicode 11 — proper wide/emoji character rendering
      const unicode11 = new Unicode11Addon()
      terminal.loadAddon(unicode11)
      terminal.unicode.activeVersion = '11'

      // Clickable URLs — open in system browser via IPC
      const webLinks = new WebLinksAddon((_event, uri) => {
        window.electronAPI.openExternal(uri)
      })
      terminal.loadAddon(webLinks)

      // Clickable file paths — open in VS Code via `code --goto`
      registerFileLinkProvider(terminal, () => {
        return useTerminalStore.getState().terminals[terminalId]?.cwd || ''
      })

      // Visual bell — brief flash on BEL character
      terminal.onBell(() => {
        containerRef.current?.classList.add('terminal-bell')
        setTimeout(() => containerRef.current?.classList.remove('terminal-bell'), 150)
      })
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    if (isReattach) {
      // Defer fit after reattach — the new container needs a layout pass before
      // fitAddon can measure the correct dimensions (otherwise the terminal
      // keeps its old size after a sibling pane is closed).
      requestAnimationFrame(() => {
        fitAddon.fit()
        ipcApi.resizePty(terminalId, terminal.cols, terminal.rows)
      })
    } else {
      fitAddon.fit()
    }

    // Capture claude flag at mount time for cleanup
    const isClaudeTerminal = useTerminalStore.getState().terminals[terminalId]?.claudeCode ?? false

    if (!isReattach) {
      // Only set up PTY and data handlers for new terminals
      registerTerminal(terminalId, terminal, (exitCode) => {
        terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
      })

      const terminalInfo = useTerminalStore.getState().terminals[terminalId]
      const startupCommand = terminalInfo?.startupCommand

      ipcApi.createPty({
        id: terminalId,
        shell: terminalInfo?.shell,
        cwd: terminalInfo?.cwd || undefined,
        cols: terminal.cols,
        rows: terminal.rows
      }).catch((err) => {
        terminal.write(`\r\n\x1b[91m[Failed to start terminal: ${err instanceof Error ? err.message : String(err)}]\x1b[0m\r\n`)
      })

      if (isClaudeTerminal) {
        ipcApi.registerClaude(terminalId)
      }

      if (startupCommand) {
        registerFirstDataCallback(terminalId, () => {
          setTimeout(() => {
            ipcApi.writePty(terminalId, startupCommand + '\r')
            useTerminalStore.getState().clearStartupCommand(terminalId)
          }, 100)
        })
      }

      let inputBuffer = ''
      terminal.onData((data) => {
        ipcApi.writePty(terminalId, data)

        // Strip escape sequences (CSI, SS3, simple ESC) before tracking input
        const cleaned = data.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
          .replace(/\x1bO[A-Za-z]/g, '')
          .replace(/\x1b./g, '')
        for (const ch of cleaned) {
          if (ch === '\r' || ch === '\n') {
            const cmd = inputBuffer.trim()
            if (cmd) {
              useTerminalStore.getState().setLastCommand(terminalId, cmd)
            }
            inputBuffer = ''
          } else if (ch === '\x7f' || ch === '\b') {
            inputBuffer = inputBuffer.slice(0, -1)
          } else if (ch >= ' ') {
            inputBuffer += ch
          }
        }
      })
    }

    // Debounce resize events; skip when hidden (display:none → 0×0 kills PTY)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (!visibleRef.current) return
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (rafId !== null) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          rafId = null
          if (fitAddonRef.current && visibleRef.current) {
            fitAddonRef.current.fit()
            if (terminalRef.current) {
              ipcApi.resizePty(terminalId, terminalRef.current.cols, terminalRef.current.rows)
            }
          }
        })
      }, RESIZE_DEBOUNCE_MS)
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      if (rafId !== null) cancelAnimationFrame(rafId)
      resizeObserver.disconnect()

      // If terminal still exists in store, this is a tree restructure (split) — persist for reattach
      const stillInStore = !!useTerminalStore.getState().terminals[terminalId]
      if (stillInStore) {
        persistedTerminals.set(terminalId, { terminal, fitAddon, searchAddon, serializeAddon })
      } else {
        // Terminal was removed — full cleanup
        searchAddonRegistry.delete(terminalId)
        serializeAddonRegistry.delete(terminalId)
        ipcApi.unregisterClaude(terminalId)
        unregisterTerminal(terminalId)
        terminal.dispose()
        ipcApi.destroyPty(terminalId).catch(() => {})
      }
    }
  }, [terminalId])

  // Refit when becoming visible
  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit()
        if (terminalRef.current) {
          ipcApi.resizePty(terminalId, terminalRef.current.cols, terminalRef.current.rows)
        }
      })
    }
  }, [isVisible, terminalId])

  // Apply font size changes
  useEffect(() => {
    if (terminalRef.current && terminalRef.current.options.fontSize !== resolvedFontSize) {
      terminalRef.current.options.fontSize = resolvedFontSize
      if (fitAddonRef.current && visibleRef.current) {
        requestAnimationFrame(() => {
          fitAddonRef.current?.fit()
          if (terminalRef.current) {
            ipcApi.resizePty(terminalId, terminalRef.current.cols, terminalRef.current.rows)
          }
        })
      }
    }
  }, [resolvedFontSize, terminalId])

  // Focus xterm when this pane becomes active
  useEffect(() => {
    if (isActive && isVisible && terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [isActive, isVisible])

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{ display: isVisible ? 'block' : 'none' }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (terminalRef.current?.hasSelection()) {
          window.electronAPI.clipboardWriteText(getCleanSelection(terminalRef.current))
          terminalRef.current.clearSelection()
        } else if (terminalRef.current) {
          pasteWithWarning(terminalRef.current)
        }
      }}
    />
  )
})

export default TerminalInstance
