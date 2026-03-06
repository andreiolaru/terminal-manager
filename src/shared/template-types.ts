export interface TerminalSlot {
  title: string
  cwd?: string
  shell?: string
  startupCommand?: string
  claudeCode?: boolean
}

export interface LayoutLeaf {
  type: 'leaf'
  terminal: TerminalSlot
}

export interface LayoutBranch {
  type: 'branch'
  direction: 'horizontal' | 'vertical'
  ratio: number
  first: LayoutNode
  second: LayoutNode
}

export type LayoutNode = LayoutLeaf | LayoutBranch

export interface BackgroundGradient {
  from: string
  to: string
  angle?: number
}

export interface LayoutTemplate {
  id: string
  name: string
  icon?: string
  color?: string
  backgroundGradient?: BackgroundGradient
  layout: LayoutNode
}
