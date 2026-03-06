import { v4 as uuid } from 'uuid'
import type { LayoutNode } from '../../shared/template-types'
import type { SplitNode, TerminalInfo } from '../store/types'
import { DEFAULT_SHELL } from './constants'

export interface InstantiateResult {
  splitTree: SplitNode
  terminals: TerminalInfo[]
  startupCommands: Array<{ terminalId: string; command: string }>
  nextTerminalNumber: number
}

function assertNever(node: never): never {
  throw new Error(`Unknown LayoutNode type: ${(node as LayoutNode).type}`)
}

export function instantiateLayoutNode(
  layout: LayoutNode,
  nextTerminalNumber: number
): InstantiateResult {
  if (layout.type === 'leaf') {
    const terminalId = uuid()
    const slot = layout.terminal
    const terminal: TerminalInfo = {
      id: terminalId,
      title: slot.title || `Terminal ${nextTerminalNumber}`,
      shell: slot.shell || DEFAULT_SHELL,
      cwd: slot.cwd || '',
      isAlive: true,
      createdAt: Date.now(),
      startupCommand: slot.startupCommand,
      claudeCode: slot.claudeCode
    }
    const startupCommands: Array<{ terminalId: string; command: string }> = []
    if (slot.startupCommand) {
      startupCommands.push({ terminalId, command: slot.startupCommand })
    }
    return {
      splitTree: { type: 'leaf', terminalId },
      terminals: [terminal],
      startupCommands,
      nextTerminalNumber: nextTerminalNumber + 1
    }
  }

  if (layout.type === 'branch') {
    const firstResult = instantiateLayoutNode(layout.first, nextTerminalNumber)
    const secondResult = instantiateLayoutNode(layout.second, firstResult.nextTerminalNumber)
    return {
      splitTree: {
        type: 'branch',
        direction: layout.direction,
        first: firstResult.splitTree,
        second: secondResult.splitTree,
        ratio: layout.ratio
      },
      terminals: [...firstResult.terminals, ...secondResult.terminals],
      startupCommands: [...firstResult.startupCommands, ...secondResult.startupCommands],
      nextTerminalNumber: secondResult.nextTerminalNumber
    }
  }

  return assertNever(layout)
}
