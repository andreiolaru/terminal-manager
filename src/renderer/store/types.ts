export type TerminalId = string

export interface TerminalInfo {
  id: TerminalId
  title: string
  shell: string
  cwd: string
  isAlive: boolean
  createdAt: number
  startupCommand?: string
  claudeCode?: boolean
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
}

export interface TerminalState {
  terminals: Record<TerminalId, TerminalInfo>
  groups: TerminalGroup[]
  activeGroupId: string | null
  nextTerminalNumber: number
  nextGroupNumber: number

  addGroup: () => string
  removeGroup: (groupId: string) => void
  setActiveGroup: (groupId: string) => void
  renameGroup: (groupId: string, label: string) => void

  addTerminal: () => TerminalId
  removeTerminal: (id: TerminalId) => void
  splitTerminal: (id: TerminalId, direction: SplitDirection) => void
  setActiveTerminal: (id: TerminalId) => void
  renameTerminal: (id: TerminalId, title: string) => void
  setTerminalDead: (id: TerminalId) => void

  cycleGroup: (delta: 1 | -1) => void
  navigatePane: (direction: NavigationDirection) => void

  instantiateLayout: (template: import('../../shared/template-types').LayoutTemplate) => string
  clearStartupCommand: (id: TerminalId) => void
}
