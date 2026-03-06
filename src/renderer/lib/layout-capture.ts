import type { SplitNode, TerminalInfo } from '../store/types'
import type { LayoutNode } from '../../shared/template-types'

function assertNever(node: never): never {
  throw new Error(`Unknown SplitNode type: ${(node as SplitNode).type}`)
}

export function captureLayout(
  splitTree: SplitNode,
  terminals: Record<string, TerminalInfo>
): LayoutNode {
  if (splitTree.type === 'leaf') {
    const info = terminals[splitTree.terminalId]
    if (!info) {
      throw new Error(`captureLayout: terminal ${splitTree.terminalId} not found in store`)
    }
    return {
      type: 'leaf',
      terminal: {
        title: info.name,
        cwd: info.cwd || undefined,
        shell: info.shell || undefined,
        claudeCode: info.claudeCode || undefined
      }
    }
  }

  if (splitTree.type === 'branch') {
    return {
      type: 'branch',
      direction: splitTree.direction,
      ratio: splitTree.ratio,
      first: captureLayout(splitTree.first, terminals),
      second: captureLayout(splitTree.second, terminals)
    }
  }

  return assertNever(splitTree)
}
