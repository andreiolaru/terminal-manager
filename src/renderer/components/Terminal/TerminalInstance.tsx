import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { ipcApi } from '../../lib/ipc-api'
import { registerTerminal, unregisterTerminal, registerFirstDataCallback } from '../../lib/pty-dispatcher'
import { useTerminalStore } from '../../store/terminal-store'
import { defaultConfig } from '../../lib/config'
import { RESIZE_DEBOUNCE_MS } from '../../lib/constants'
import '@xterm/xterm/css/xterm.css'
import '../../assets/styles/terminal.css'

interface TerminalInstanceProps {
  terminalId: string
  isVisible: boolean
  isActive: boolean
}

export default function TerminalInstance({ terminalId, isVisible, isActive }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const visibleRef = useRef(isVisible)
  visibleRef.current = isVisible

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: defaultConfig.font.size,
      fontFamily: defaultConfig.font.family,
      theme: {
        background: defaultConfig.theme.background,
        foreground: defaultConfig.theme.foreground,
        cursor: defaultConfig.theme.cursor,
        selectionBackground: defaultConfig.theme.selectionBackground
      },
      scrollback: defaultConfig.scrollback
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.attachCustomKeyEventHandler((e) => {
      // Let Electron menu accelerators handle these combos
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.shiftKey && ['T', 'W', 'D', 'E'].includes(e.key)) return false
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

    fitAddon.fit()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Register with centralized dispatcher for O(1) IPC routing
    registerTerminal(terminalId, terminal, (exitCode) => {
      terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
    })

    const terminalInfo = useTerminalStore.getState().terminals[terminalId]
    const initialTitle = terminalInfo?.title ?? ''
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

    if (terminalInfo?.claudeCode) {
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
    const onDataDisposable = terminal.onData((data) => {
      ipcApi.writePty(terminalId, data)

      // Strip escape sequences (CSI, SS3, simple ESC) before tracking input
      const cleaned = data.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        .replace(/\x1bO[A-Za-z]/g, '')
        .replace(/\x1b./g, '')
      for (const ch of cleaned) {
        if (ch === '\r') {
          const cmd = inputBuffer.trim()
          if (cmd) {
            useTerminalStore.getState().renameTerminal(terminalId, `${initialTitle} - ${cmd}`)
          }
          inputBuffer = ''
        } else if (ch === '\x7f' || ch === '\b') {
          inputBuffer = inputBuffer.slice(0, -1)
        } else if (ch >= ' ') {
          inputBuffer += ch
        }
      }
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
      if (terminalInfo?.claudeCode) {
        ipcApi.unregisterClaude(terminalId)
      }
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
        }
      })
    }
  }, [isVisible, terminalId])

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
    />
  )
}
