export type { TerminalId, SplitDirection, SplitLeaf, SplitBranch, SplitNode } from '../../shared/split-types'
import type { TerminalId } from '../../shared/split-types'

export type ClaudeCodeStatus = 'not-tracked' | 'idle' | 'working' | 'needs-input' | 'completed'

export interface TerminalInfo {
  id: TerminalId
  name: string
  lastCommand?: string
  shell: string
  cwd: string
  isAlive: boolean
  createdAt: number
  startupCommand?: string
  claudeCode?: boolean
  claudeStatus?: ClaudeCodeStatus
  claudeStatusTitle?: string
  claudeModel?: string
  claudeContext?: string
  fontSize?: number
}

export type NavigationDirection = 'left' | 'right' | 'up' | 'down'

export interface TerminalGroup {
  id: string
  label: string
  splitTree: SplitNode
  activeTerminalId: TerminalId
  icon?: string
  color?: string
  backgroundGradient?: {
    from: string
    to: string
    angle?: number
  }
  fontSize?: number
  zoomedTerminalId?: TerminalId
}

export interface TerminalState {
  terminals: Record<TerminalId, TerminalInfo>
  groups: TerminalGroup[]
  activeGroupId: string | null
  nextTerminalNumber: number
  nextGroupNumber: number
  sidebarCollapsed: boolean
  titleBarVisible: boolean
  restoreScrollback: boolean
  globalFontSize: number

  addGroup: () => string
  removeGroup: (groupId: string) => void
  setActiveGroup: (groupId: string) => void
  renameGroup: (groupId: string, label: string) => void

  addTerminal: () => TerminalId
  removeTerminal: (id: TerminalId) => void
  splitTerminal: (id: TerminalId, direction: SplitDirection) => void
  setActiveTerminal: (id: TerminalId) => void
  renameTerminal: (id: TerminalId, name: string) => void
  setLastCommand: (id: TerminalId, command: string) => void
  setTerminalDead: (id: TerminalId) => void

  cycleGroup: (delta: 1 | -1) => void
  navigatePane: (direction: NavigationDirection) => void

  instantiateLayout: (template: import('../../shared/template-types').LayoutTemplate) => string
  clearStartupCommand: (id: TerminalId) => void
  setClaudeStatus: (id: TerminalId, status: ClaudeCodeStatus, contextTitle?: string) => void
  setClaudeInfo: (id: TerminalId, model?: string, context?: string) => void
  toggleSidebar: () => void
  toggleTitleBar: () => void
  toggleRestoreScrollback: () => void

  setGlobalFontSize: (size: number) => void
  setGroupFontSize: (groupId: string, size: number | undefined) => void
  setTerminalFontSize: (id: TerminalId, size: number | undefined) => void
  toggleZoom: (id: TerminalId) => void
  restoreSession: (session: import('../../shared/session-types').SessionData) => void
}
