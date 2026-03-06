import type { SplitNode, SplitDirection, TerminalId } from '../store/types'

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

  const newFirst = splitNode(tree.first, targetId, direction, newTerminalId)
  const newSecond = splitNode(tree.second, targetId, direction, newTerminalId)

  if (newFirst === tree.first && newSecond === tree.second) return tree

  return { ...tree, first: newFirst, second: newSecond }
}

export function removeNode(
  tree: SplitNode,
  targetId: TerminalId
): SplitNode | null {
  if (tree.type === 'leaf') {
    return tree.terminalId === targetId ? null : tree
  }

  const newFirst = removeNode(tree.first, targetId)
  const newSecond = removeNode(tree.second, targetId)

  if (newFirst === null && newSecond === null) return null
  if (newFirst === null) return newSecond
  if (newSecond === null) return newFirst
  if (newFirst === tree.first && newSecond === tree.second) return tree

  return { ...tree, first: newFirst, second: newSecond }
}

export function collectLeafIds(tree: SplitNode): TerminalId[] {
  if (tree.type === 'leaf') return [tree.terminalId]
  return [...collectLeafIds(tree.first), ...collectLeafIds(tree.second)]
}

export function containsLeaf(tree: SplitNode, terminalId: TerminalId): boolean {
  if (tree.type === 'leaf') return tree.terminalId === terminalId
  return containsLeaf(tree.first, terminalId) || containsLeaf(tree.second, terminalId)
}
