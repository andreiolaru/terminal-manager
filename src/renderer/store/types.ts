export type TerminalId = string

export interface TerminalInfo {
  id: TerminalId
  title: string
  shell: string
  cwd: string
  isAlive: boolean
  createdAt: number
}

export type SplitDirection = 'horizontal' | 'vertical'

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
}

export interface TerminalState {
  terminals: Record<TerminalId, TerminalInfo>
  activeTerminalId: TerminalId | null
  nextTerminalNumber: number
  splitTree: SplitNode | null

  addTerminal: () => TerminalId
  removeTerminal: (id: TerminalId) => void
  splitTerminal: (id: TerminalId, direction: SplitDirection) => void
  setActiveTerminal: (id: TerminalId) => void
  renameTerminal: (id: TerminalId, title: string) => void
  setTerminalDead: (id: TerminalId) => void
}
