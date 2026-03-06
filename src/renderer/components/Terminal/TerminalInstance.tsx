import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { ipcApi } from '../../lib/ipc-api'
import { DEFAULT_SCROLLBACK } from '../../lib/constants'
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
      // DOM renderer fallback
    }

    fitAddon.fit()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    ipcApi.createPty({
      id: terminalId,
      cols: terminal.cols,
      rows: terminal.rows
    })

    const unsubData = ipcApi.onPtyData((id, data) => {
      if (id === terminalId) {
        terminal.write(data)
      }
    })

    const unsubExit = ipcApi.onPtyExit((id, exitCode) => {
      if (id === terminalId) {
        terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
      }
    })

    const onDataDisposable = terminal.onData((data) => {
      ipcApi.writePty(terminalId, data)
    })

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
          if (terminalRef.current) {
            ipcApi.resizePty(terminalId, terminalRef.current.cols, terminalRef.current.rows)
          }
        }
      })
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      onDataDisposable.dispose()
      unsubData()
      unsubExit()
      terminal.dispose()
      ipcApi.destroyPty(terminalId)
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
