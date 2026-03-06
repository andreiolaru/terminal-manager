export type TerminalId = string

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

export type SplitDirection = 'horizontal' | 'vertical'
export type NavigationDirection = 'left' | 'right' | 'up' | 'down'

export interface SplitLeaf {
  type: 'leaf'
  terminalId: TerminalId
}

export interface SplitBranch {
  type: 'branch'
  direction: SplitDirection
  first: SplitNode
  second: SplitNode
  ratio: number
}

export type SplitNode = SplitLeaf | SplitBranch

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
}

export interface TerminalState {
  terminals: Record<TerminalId, TerminalInfo>
  groups: TerminalGroup[]
  activeGroupId: string | null
  nextTerminalNumber: number
  nextGroupNumber: number
  sidebarCollapsed: boolean
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

  setGlobalFontSize: (size: number) => void
  setGroupFontSize: (groupId: string, size: number | undefined) => void
  setTerminalFontSize: (id: TerminalId, size: number | undefined) => void
}
