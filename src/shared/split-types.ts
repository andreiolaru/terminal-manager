export type TerminalId = string

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
