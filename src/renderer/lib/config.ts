export interface TerminalConfig {
  shell: {
    default: string
  }
  font: {
    family: string
    size: number
  }
  scrollback: number
  theme: {
    // Terminal emulator colors
    background: string
    foreground: string
    cursor: string
    selectionBackground: string
    // UI chrome colors
    sidebarBackground: string
    panelBackground: string
    titleBarBackground: string
    tabBarBackground: string
    tabActiveBackground: string
    tabInactiveBackground: string
    border: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    accentColor: string
    dangerColor: string
    // Interactive states
    hoverBackground: string
    listHoverBackground: string
    listActiveBackground: string
    tabHoverBackground: string
    // Scrollbar
    scrollbarThumb: string
    scrollbarThumbHover: string
  }
  window: {
    opacity: number
  }
}

const isWindows = typeof navigator !== 'undefined'
  ? navigator.userAgent.includes('Windows')
  : process.platform === 'win32'

export const defaultConfig: TerminalConfig = {
  shell: {
    default: isWindows ? 'powershell.exe' : 'zsh'
  },
  font: {
    family: "'Cascadia Code', 'Consolas', monospace",
    size: 14
  },
  scrollback: 5000,
  theme: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    selectionBackground: '#264f78',
    sidebarBackground: '#252526',
    panelBackground: '#1e1e1e',
    titleBarBackground: '#2d2d2d',
    tabBarBackground: '#252526',
    tabActiveBackground: '#1e1e1e',
    tabInactiveBackground: '#2d2d2d',
    border: '#3c3c3c',
    textPrimary: '#cccccc',
    textSecondary: '#999999',
    textMuted: '#666666',
    accentColor: '#007acc',
    dangerColor: '#b13a3a',
    hoverBackground: '#3c3c3c',
    listHoverBackground: '#2a2d2e',
    listActiveBackground: '#37373d',
    tabHoverBackground: '#333333',
    scrollbarThumb: 'rgba(255, 255, 255, 0.15)',
    scrollbarThumbHover: 'rgba(255, 255, 255, 0.25)'
  },
  window: {
    opacity: 1.0
  }
}
