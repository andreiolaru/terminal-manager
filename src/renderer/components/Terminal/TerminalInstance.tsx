import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { ipcApi } from '../../lib/ipc-api'
import { registerTerminal, unregisterTerminal } from '../../lib/pty-dispatcher'
import { DEFAULT_SCROLLBACK, RESIZE_DEBOUNCE_MS } from '../../lib/constants'
import '@xterm/xterm/css/xterm.css'
import '../../assets/styles/terminal.css'

interface TerminalInstanceProps {
  terminalId: string
  isVisible: boolean
}

export default function TerminalInstance({ terminalId, isVisible }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const visibleRef = useRef(isVisible)
  visibleRef.current = isVisible

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff'
      },
      scrollback: DEFAULT_SCROLLBACK
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)

    try {
      terminal.loadAddon(new WebglAddon())
    } catch {
      console.warn('WebGL addon failed to load, using canvas renderer')
    }

    fitAddon.fit()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Register with centralized dispatcher for O(1) IPC routing
    registerTerminal(terminalId, terminal, (exitCode) => {
      terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
    })

    ipcApi.createPty({
      id: terminalId,
      cols: terminal.cols,
      rows: terminal.rows
    }).catch((err) => {
      terminal.write(`\r\n\x1b[91m[Failed to start terminal: ${err instanceof Error ? err.message : String(err)}]\x1b[0m\r\n`)
    })

    const onDataDisposable = terminal.onData((data) => {
      ipcApi.writePty(terminalId, data)
    })

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
      onDataDisposable.dispose()
      unregisterTerminal(terminalId)
      terminal.dispose()
      ipcApi.destroyPty(terminalId).catch(() => {})
    }
  }, [terminalId])

  // Refit when becoming visible
  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit()
        if (terminalRef.current) {
          ipcApi.resizePty(terminalId, terminalRef.current.cols, terminalRef.current.rows)
          terminalRef.current.focus()
        }
      })
    }
  }, [isVisible, terminalId])

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{ display: isVisible ? 'block' : 'none' }}
    />
  )
}
