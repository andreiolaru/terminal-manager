import type { SplitNode } from './split-types'

export interface WindowState {
  width: number
  height: number
  x: number
  y: number
  isMaximized: boolean
}

export interface SerializedTerminal {
  id: string
  name: string
  shell: string
  cwd: string
  claudeCode?: boolean
  fontSize?: number
  composeBarVisible?: boolean
  scrollback?: string
}

export interface SerializedGroup {
  id: string
  label: string
  splitTree: SplitNode
  activeTerminalId: string
  icon?: string
  color?: string
  backgroundGradient?: { from: string; to: string; angle?: number }
  fontSize?: number
}

export interface SessionData {
  terminals: Record<string, SerializedTerminal>
  groups: SerializedGroup[]
  activeGroupId: string | null
  nextTerminalNumber: number
  nextGroupNumber: number
  sidebarCollapsed: boolean
  titleBarVisible: boolean
  restoreScrollback: boolean
  globalFontSize: number
  globalComposeBar?: boolean
}
