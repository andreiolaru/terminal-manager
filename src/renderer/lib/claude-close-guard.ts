import { useTerminalStore } from '../store/terminal-store'
import { collectLeafIds } from './tree-utils'
import type { TerminalInfo, TerminalGroup } from '../store/types'

function isClaudeActive(terminal: TerminalInfo | undefined): boolean {
  if (!terminal) return false
  return terminal.isAlive && !!terminal.claudeStatus && terminal.claudeStatus !== 'not-tracked'
}

function getClaudeTerminalNames(terminalIds: string[]): string[] {
  const { terminals } = useTerminalStore.getState()
  return terminalIds
    .filter((id) => isClaudeActive(terminals[id]))
    .map((id) => terminals[id].name)
}

async function showConfirm(title: string, message: string, detail: string): Promise<boolean> {
  if (!window.electronAPI?.confirmClose) return true
  return window.electronAPI.confirmClose(title, message, detail)
}

/**
 * Returns true if the terminal can be closed (no Claude, or user confirmed).
 */
export async function confirmTerminalClose(terminalId: string): Promise<boolean> {
  const terminal = useTerminalStore.getState().terminals[terminalId]
  if (!isClaudeActive(terminal)) return true

  return showConfirm(
    'Close Terminal',
    `Claude is running in "${terminal.name}".`,
    'Are you sure you want to close this terminal?'
  )
}

/**
 * Returns true if the group can be closed (no Claude terminals, or user confirmed).
 */
export async function confirmGroupClose(groupId: string): Promise<boolean> {
  const { groups, terminals } = useTerminalStore.getState()
  const group = groups.find((g) => g.id === groupId)
  if (!group) return true

  const leafIds = collectLeafIds(group.splitTree)
  const names = getClaudeTerminalNames(leafIds)
  if (names.length === 0) return true

  const list = names.map((n) => `  \u2022 ${n}`).join('\n')
  return showConfirm(
    'Close Group',
    `Claude is running in ${names.length} terminal${names.length > 1 ? 's' : ''}:`,
    `${list}\n\nAre you sure you want to close this group?`
  )
}

/**
 * Returns true if the app can be closed (no Claude terminals, or user confirmed).
 */
export async function confirmAppClose(): Promise<boolean> {
  const { groups, terminals } = useTerminalStore.getState()

  const groupEntries: { label: string; names: string[] }[] = []
  for (const group of groups) {
    const leafIds = collectLeafIds(group.splitTree)
    const names = leafIds
      .filter((id) => isClaudeActive(terminals[id]))
      .map((id) => terminals[id].name)
    if (names.length > 0) {
      groupEntries.push({ label: group.label, names })
    }
  }

  if (groupEntries.length === 0) return true

  const totalCount = groupEntries.reduce((sum, g) => sum + g.names.length, 0)

  let detail: string
  if (groupEntries.length === 1 && groupEntries[0].names.length === 1) {
    detail = `  \u2022 ${groupEntries[0].names[0]}\n\nAre you sure you want to exit?`
  } else {
    const sections = groupEntries.map((g) => {
      const list = g.names.map((n) => `    \u2022 ${n}`).join('\n')
      return `  ${g.label}:\n${list}`
    }).join('\n\n')
    detail = `${sections}\n\nAre you sure you want to exit?`
  }

  return showConfirm(
    'Exit Application',
    `Claude is running in ${totalCount} terminal${totalCount > 1 ? 's' : ''}:`,
    detail
  )
}
