import type { SplitNode, SplitDirection, TerminalId, NavigationDirection } from '../store/types'

function assertNever(node: never): never {
  throw new Error(`Unknown SplitNode type: ${(node as SplitNode).type}`)
}

export function splitNode(
  tree: SplitNode,
  targetId: TerminalId,
  direction: SplitDirection,
  newTerminalId: TerminalId
): SplitNode {
  if (tree.type === 'leaf') {
    if (tree.terminalId === targetId) {
      return {
        type: 'branch',
        direction,
        first: tree,
        second: { type: 'leaf', terminalId: newTerminalId },
        ratio: 0.5
      }
    }
    return tree
  }

  if (tree.type === 'branch') {
    const newFirst = splitNode(tree.first, targetId, direction, newTerminalId)
    const newSecond = splitNode(tree.second, targetId, direction, newTerminalId)

    if (newFirst === tree.first && newSecond === tree.second) return tree

    return { ...tree, first: newFirst, second: newSecond }
  }

  return assertNever(tree)
}

export function removeNode(
  tree: SplitNode,
  targetId: TerminalId
): SplitNode | null {
  if (tree.type === 'leaf') {
    return tree.terminalId === targetId ? null : tree
  }

  if (tree.type === 'branch') {
    const newFirst = removeNode(tree.first, targetId)
    const newSecond = removeNode(tree.second, targetId)

    if (newFirst === null && newSecond === null) return null
    if (newFirst === null) return newSecond
    if (newSecond === null) return newFirst
    if (newFirst === tree.first && newSecond === tree.second) return tree

    return { ...tree, first: newFirst, second: newSecond }
  }

  return assertNever(tree)
}

export function collectLeafIds(tree: SplitNode): TerminalId[] {
  if (tree.type === 'leaf') return [tree.terminalId]
  if (tree.type === 'branch') return [...collectLeafIds(tree.first), ...collectLeafIds(tree.second)]
  return assertNever(tree)
}

export function containsLeaf(tree: SplitNode, terminalId: TerminalId): boolean {
  if (tree.type === 'leaf') return tree.terminalId === terminalId
  if (tree.type === 'branch') return containsLeaf(tree.first, terminalId) || containsLeaf(tree.second, terminalId)
  return assertNever(tree)
}

type PathStep = { node: SplitNode; side: 'first' | 'second' }

function buildPath(tree: SplitNode, targetId: TerminalId): PathStep[] | null {
  if (tree.type === 'leaf') {
    return tree.terminalId === targetId ? [] : null
  }
  if (tree.type === 'branch') {
    const leftPath = buildPath(tree.first, targetId)
    if (leftPath !== null) return [{ node: tree, side: 'first' }, ...leftPath]
    const rightPath = buildPath(tree.second, targetId)
    if (rightPath !== null) return [{ node: tree, side: 'second' }, ...rightPath]
    return null
  }
  return assertNever(tree)
}

function edgeLeaf(tree: SplitNode, side: 'first' | 'second'): TerminalId {
  if (tree.type === 'leaf') return tree.terminalId
  if (tree.type === 'branch') return edgeLeaf(tree[side], side)
  return assertNever(tree)
}

const NAV_AXIS: Record<NavigationDirection, SplitDirection> = {
  left: 'horizontal',
  right: 'horizontal',
  up: 'vertical',
  down: 'vertical'
}

const DEPARTING_SIDE: Record<NavigationDirection, 'first' | 'second'> = {
  left: 'second',
  right: 'first',
  up: 'second',
  down: 'first'
}

export function findAdjacentTerminal(
  tree: SplitNode,
  currentId: TerminalId,
  direction: NavigationDirection
): TerminalId | null {
  const path = buildPath(tree, currentId)
  if (!path) return null

  const axis = NAV_AXIS[direction]
  const departing = DEPARTING_SIDE[direction]
  const arriving: 'first' | 'second' = departing === 'first' ? 'second' : 'first'

  // Walk up from leaf to find nearest branch matching axis where we're on the departing side
  for (let i = path.length - 1; i >= 0; i--) {
    const step = path[i]
    const branch = step.node
    if (branch.type === 'branch' && branch.direction === axis && step.side === departing) {
      // Cross to sibling subtree, drill to nearest edge
      return edgeLeaf(branch[arriving], departing)
    }
  }

  return null
}
