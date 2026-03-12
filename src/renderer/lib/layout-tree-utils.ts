import type { LayoutNode, LayoutLeaf } from '../../shared/template-types'

export type NodePath = ('first' | 'second')[]

function defaultLeaf(title: string): LayoutLeaf {
  return { type: 'leaf', terminal: { title } }
}

export function getNodeAtPath(root: LayoutNode, path: NodePath): LayoutNode | null {
  let node: LayoutNode = root
  for (const step of path) {
    if (node.type !== 'branch') return null
    node = node[step]
  }
  return node
}

export function replaceNodeAtPath(root: LayoutNode, path: NodePath, replacement: LayoutNode): LayoutNode {
  if (path.length === 0) return replacement
  if (root.type !== 'branch') return root

  const [step, ...rest] = path
  const child = root[step]
  const newChild = replaceNodeAtPath(child, rest, replacement)
  if (newChild === child) return root
  return { ...root, [step]: newChild }
}

export function splitLeafAtPath(
  root: LayoutNode,
  path: NodePath,
  direction: 'horizontal' | 'vertical',
  newTitle: string
): LayoutNode {
  const target = getNodeAtPath(root, path)
  if (!target || target.type !== 'leaf') return root

  const branch: LayoutNode = {
    type: 'branch',
    direction,
    ratio: 0.5,
    first: target,
    second: defaultLeaf(newTitle)
  }
  return replaceNodeAtPath(root, path, branch)
}

export function removeLeafAtPath(root: LayoutNode, path: NodePath): LayoutNode | null {
  if (path.length === 0) {
    return root.type === 'leaf' ? null : root
  }

  if (root.type !== 'branch') return root

  const [step, ...rest] = path
  if (rest.length === 0) {
    // Direct child — promote sibling
    const sibling = step === 'first' ? 'second' : 'first'
    return root[sibling]
  }

  const child = root[step]
  const newChild = removeLeafAtPath(child, rest)
  if (newChild === null) {
    const sibling = step === 'first' ? 'second' : 'first'
    return root[sibling]
  }
  if (newChild === child) return root
  return { ...root, [step]: newChild }
}

export function countLeaves(root: LayoutNode): number {
  if (root.type === 'leaf') return 1
  return countLeaves(root.first) + countLeaves(root.second)
}

export function pathsEqual(a: NodePath | null, b: NodePath | null): boolean {
  if (a === null || b === null) return a === b
  if (a.length !== b.length) return false
  return a.every((step, i) => step === b[i])
}

/** Generate a default title for a new pane based on leaf count */
export function nextPaneTitle(root: LayoutNode): string {
  return `Terminal ${countLeaves(root) + 1}`
}

export function updateRatioAtPath(root: LayoutNode, path: NodePath, ratio: number): LayoutNode {
  const node = getNodeAtPath(root, path)
  if (!node || node.type !== 'branch') return root
  return replaceNodeAtPath(root, path, { ...node, ratio: Math.max(0.1, Math.min(0.9, ratio)) })
}
