import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type { TerminalState, TerminalGroup, NavigationDirection } from './types'
import type { LayoutTemplate } from '../../shared/template-types'
import type { SessionData } from '../../shared/session-types'
import { pendingScrollback } from '../lib/pending-scrollback'
import { DEFAULT_SHELL, DEFAULT_FONT_SIZE } from '../lib/constants'
import { destroyPtySafe } from '../lib/ipc-api'
import { splitNode as splitTreeNode, removeNode, collectLeafIds, containsLeaf, findAdjacentTerminal } from '../lib/tree-utils'
import { instantiateLayoutNode } from '../lib/template-utils'

function findGroupForTerminal(groups: TerminalGroup[], terminalId: string): TerminalGroup | undefined {
  return groups.find((g) => containsLeaf(g.splitTree, terminalId))
}

export function getSessionData(state: TerminalState): SessionData {
  const terminals: SessionData['terminals'] = {}
  for (const [id, t] of Object.entries(state.terminals)) {
    terminals[id] = {
      id: t.id,
      name: t.name,
      shell: t.shell,
      cwd: t.cwd,
      ...(t.claudeCode ? { claudeCode: true } : {}),
      ...(t.fontSize !== undefined ? { fontSize: t.fontSize } : {}),
      ...(t.composeBarVisible !== undefined ? { composeBarVisible: t.composeBarVisible } : {})
    }
  }

  const groups: SessionData['groups'] = state.groups.map((g) => ({
    id: g.id,
    label: g.label,
    splitTree: g.splitTree,
    activeTerminalId: g.activeTerminalId,
    ...(g.icon ? { icon: g.icon } : {}),
    ...(g.color ? { color: g.color } : {}),
    ...(g.backgroundGradient ? { backgroundGradient: g.backgroundGradient } : {}),
    ...(g.fontSize !== undefined ? { fontSize: g.fontSize } : {})
  }))

  return {
    terminals,
    groups,
    activeGroupId: state.activeGroupId,
    nextTerminalNumber: state.nextTerminalNumber,
    nextGroupNumber: state.nextGroupNumber,
    sidebarCollapsed: state.sidebarCollapsed,
    titleBarVisible: state.titleBarVisible,
    restoreScrollback: state.restoreScrollback,
    globalFontSize: state.globalFontSize,
    globalComposeBar: state.globalComposeBar
  }
}

export const useTerminalStore = create<TerminalState>()(
  immer((set) => ({
    terminals: {},
    groups: [],
    activeGroupId: null,
    nextTerminalNumber: 1,
    nextGroupNumber: 1,
    sidebarCollapsed: false,
    titleBarVisible: true,
    restoreScrollback: false,
    globalFontSize: DEFAULT_FONT_SIZE,
    globalComposeBar: true,

    addGroup: (): string => {
      const groupId = uuid()
      const terminalId = uuid()
      const now = Date.now()
      set((state) => {
        state.terminals[terminalId] = {
          id: terminalId,
          name: `Terminal ${state.nextTerminalNumber}`,
          shell: DEFAULT_SHELL,
          cwd: '',
          isAlive: true,
          createdAt: now
        }
        state.nextTerminalNumber++
        state.groups.push({
          id: groupId,
          label: `Group ${state.nextGroupNumber}`,
          splitTree: { type: 'leaf', terminalId },
          activeTerminalId: terminalId
        })
        state.nextGroupNumber++
        state.activeGroupId = groupId
      })
      return groupId
    },

    removeGroup: (groupId): void => {
      // Snapshot terminal IDs before state mutation for PTY cleanup
      const currentState = useTerminalStore.getState()
      const group = currentState.groups.find((g) => g.id === groupId)
      if (!group) return
      const terminalIds = collectLeafIds(group.splitTree)

      set((state) => {
        const groupIndex = state.groups.findIndex((g) => g.id === groupId)
        if (groupIndex === -1) return

        for (const tid of terminalIds) {
          delete state.terminals[tid]
        }

        state.groups.splice(groupIndex, 1)

        if (state.activeGroupId === groupId) {
          if (state.groups.length > 0) {
            const newIndex = Math.min(groupIndex, state.groups.length - 1)
            state.activeGroupId = state.groups[newIndex].id
          } else {
            state.activeGroupId = null
          }
        }
      })

      // Explicit PTY cleanup — don't rely solely on React unmount
      for (const tid of terminalIds) {
        destroyPtySafe(tid)
      }
    },

    setActiveGroup: (groupId): void => {
      set((state) => {
        if (state.groups.some((g) => g.id === groupId)) {
          state.activeGroupId = groupId
        }
      })
    },

    renameGroup: (groupId, label): void => {
      set((state) => {
        const group = state.groups.find((g) => g.id === groupId)
        if (group) {
          group.label = label
        }
      })
    },

    addTerminal: (): string => {
      // C5: Check state before set() — no fragile delegatedToAddGroup flag
      const currentState = useTerminalStore.getState()
      const hasActiveGroup = currentState.groups.some((g) => g.id === currentState.activeGroupId)

      if (!hasActiveGroup) {
        const groupId = useTerminalStore.getState().addGroup()
        const group = useTerminalStore.getState().groups.find((g) => g.id === groupId)
        if (!group) {
          return ''
        }
        return group.activeTerminalId
      }

      const id = uuid()
      const now = Date.now()
      set((state) => {
        const activeGroup = state.groups.find((g) => g.id === state.activeGroupId)
        if (!activeGroup) return

        state.terminals[id] = {
          id,
          name: `Terminal ${state.nextTerminalNumber}`,
          shell: DEFAULT_SHELL,
          cwd: '',
          isAlive: true,
          createdAt: now
        }
        state.nextTerminalNumber++

        activeGroup.splitTree = splitTreeNode(
          activeGroup.splitTree,
          activeGroup.activeTerminalId,
          'horizontal',
          id
        )
        activeGroup.activeTerminalId = id
      })
      return id
    },

    removeTerminal: (id): void => {
      const exists = !!useTerminalStore.getState().terminals[id]

      set((state) => {
        if (!state.terminals[id]) return

        const group = findGroupForTerminal(state.groups, id)
        if (!group) {
          delete state.terminals[id]
          return
        }

        delete state.terminals[id]

        const newTree = removeNode(group.splitTree, id)
        if (newTree === null) {
          // Last terminal in group — remove the group
          const groupIndex = state.groups.findIndex((g) => g.id === group.id)
          state.groups.splice(groupIndex, 1)

          if (state.activeGroupId === group.id) {
            if (state.groups.length > 0) {
              const newIndex = Math.min(groupIndex, state.groups.length - 1)
              state.activeGroupId = state.groups[newIndex].id
            } else {
              state.activeGroupId = null
            }
          }
        } else {
          group.splitTree = newTree
          if (group.zoomedTerminalId === id) {
            group.zoomedTerminalId = undefined
          }
          if (group.activeTerminalId === id) {
            // C6: Guard against empty remaining array
            const remaining = collectLeafIds(newTree)
            if (remaining.length > 0) {
              group.activeTerminalId = remaining[0]
            }
          }
        }
      })

      // Explicit PTY cleanup — don't rely solely on React unmount
      if (exists) {
        destroyPtySafe(id)
      }
    },

    splitTerminal: (id, direction): void => {
      const newId = uuid()
      const now = Date.now()
      set((state) => {
        if (!state.terminals[id]) return

        const group = findGroupForTerminal(state.groups, id)
        if (!group) return

        state.terminals[newId] = {
          id: newId,
          name: `Terminal ${state.nextTerminalNumber}`,
          shell: DEFAULT_SHELL,
          cwd: '',
          isAlive: true,
          createdAt: now
        }
        state.nextTerminalNumber++

        group.splitTree = splitTreeNode(group.splitTree, id, direction, newId)
        group.activeTerminalId = newId
      })
    },

    setActiveTerminal: (id): void => {
      set((state) => {
        if (!state.terminals[id]) return

        const group = findGroupForTerminal(state.groups, id)
        if (!group) return

        group.activeTerminalId = id
        state.activeGroupId = group.id
      })
    },

    renameTerminal: (id, name): void => {
      set((state) => {
        if (state.terminals[id]) {
          state.terminals[id].name = name
        }
      })
    },

    setLastCommand: (id, command): void => {
      set((state) => {
        if (state.terminals[id]) {
          state.terminals[id].lastCommand = command
        }
      })
    },

    setTerminalDead: (id): void => {
      set((state) => {
        if (state.terminals[id]) {
          state.terminals[id].isAlive = false
        }
      })
    },

    cycleGroup: (delta): void => {
      set((state) => {
        if (state.groups.length <= 1) return
        const currentIndex = state.groups.findIndex((g) => g.id === state.activeGroupId)
        if (currentIndex === -1) return
        const nextIndex = (currentIndex + delta + state.groups.length) % state.groups.length
        state.activeGroupId = state.groups[nextIndex].id
      })
    },

    navigatePane: (direction: NavigationDirection): void => {
      const currentState = useTerminalStore.getState()
      const group = currentState.groups.find((g) => g.id === currentState.activeGroupId)
      if (!group) return

      const targetId = findAdjacentTerminal(group.splitTree, group.activeTerminalId, direction)
      if (targetId) {
        useTerminalStore.getState().setActiveTerminal(targetId)
      }
    },

    instantiateLayout: (template: LayoutTemplate): string => {
      const groupId = uuid()
      let failed = false

      set((state) => {
        const result = instantiateLayoutNode(template.layout, state.nextTerminalNumber)

        if (result.terminals.length === 0) {
          failed = true
          return
        }

        for (const t of result.terminals) {
          state.terminals[t.id] = t
        }
        state.nextTerminalNumber = result.nextTerminalNumber

        const group: TerminalGroup = {
          id: groupId,
          label: template.name,
          splitTree: result.splitTree,
          activeTerminalId: result.terminals[0].id,
          icon: template.icon,
          color: template.color,
          backgroundGradient: template.backgroundGradient
        }
        state.groups.push(group)
        state.nextGroupNumber++
        state.activeGroupId = groupId
      })
      return failed ? '' : groupId
    },

    clearStartupCommand: (id): void => {
      set((state) => {
        if (state.terminals[id]) {
          delete state.terminals[id].startupCommand
        }
      })
    },

    setClaudeStatus: (id, status, contextTitle): void => {
      set((state) => {
        if (state.terminals[id]) {
          state.terminals[id].claudeStatus = status
          state.terminals[id].claudeStatusTitle = contextTitle
          if (!state.terminals[id].claudeCode) {
            state.terminals[id].claudeCode = true
          }
        }
      })
    },

    setClaudeInfo: (id, model, context): void => {
      set((state) => {
        if (!state.terminals[id]) return
        if (model !== undefined) state.terminals[id].claudeModel = model
        if (context !== undefined) state.terminals[id].claudeContext = context
      })
    },

    toggleSidebar: (): void => {
      set((state) => {
        state.sidebarCollapsed = !state.sidebarCollapsed
      })
    },

    toggleTitleBar: (): void => {
      set((state) => {
        state.titleBarVisible = !state.titleBarVisible
      })
    },

    toggleRestoreScrollback: (): void => {
      set((state) => {
        state.restoreScrollback = !state.restoreScrollback
      })
    },

    setGlobalFontSize: (size): void => {
      set((state) => {
        state.globalFontSize = Math.min(32, Math.max(8, size))
      })
    },

    setGroupFontSize: (groupId, size): void => {
      set((state) => {
        const group = state.groups.find((g) => g.id === groupId)
        if (group) {
          group.fontSize = size !== undefined ? Math.min(32, Math.max(8, size)) : undefined
        }
      })
    },

    setTerminalFontSize: (id, size): void => {
      set((state) => {
        if (state.terminals[id]) {
          state.terminals[id].fontSize = size !== undefined ? Math.min(32, Math.max(8, size)) : undefined
        }
      })
    },

    toggleZoom: (id): void => {
      set((state) => {
        const group = state.groups.find((g) =>
          g.splitTree.type === 'leaf'
            ? g.splitTree.terminalId === id
            : JSON.stringify(g.splitTree).includes(id)
        )
        if (group) {
          group.zoomedTerminalId = group.zoomedTerminalId === id ? undefined : id
        }
      })
    },

    toggleComposeBar: (id): void => {
      set((state) => {
        if (state.terminals[id]) {
          const current = state.terminals[id].composeBarVisible
          // Cycle: undefined (inherit) → false (off) → true (on) → undefined
          if (current === undefined) state.terminals[id].composeBarVisible = false
          else if (current === false) state.terminals[id].composeBarVisible = true
          else state.terminals[id].composeBarVisible = undefined
        }
      })
    },

    toggleGlobalComposeBar: (): void => {
      set((state) => {
        state.globalComposeBar = !state.globalComposeBar
      })
    },

    restoreSession: (session: SessionData): void => {
      pendingScrollback.clear()
      if (session.restoreScrollback) {
        for (const [id, t] of Object.entries(session.terminals)) {
          if (t.scrollback) {
            pendingScrollback.set(id, t.scrollback)
          }
        }
      }
      set((state) => {
        const now = Date.now()
        state.terminals = {}
        for (const [id, t] of Object.entries(session.terminals)) {
          state.terminals[id] = {
            id: t.id,
            name: t.name,
            shell: t.shell,
            cwd: t.cwd,
            isAlive: true,
            createdAt: now,
            claudeCode: t.claudeCode,
            fontSize: t.fontSize,
            composeBarVisible: t.composeBarVisible
          }
        }
        state.groups = session.groups.map((g) => ({
          id: g.id,
          label: g.label,
          splitTree: g.splitTree,
          activeTerminalId: g.activeTerminalId,
          icon: g.icon,
          color: g.color,
          backgroundGradient: g.backgroundGradient,
          fontSize: g.fontSize
        }))
        state.activeGroupId = session.activeGroupId
        state.nextTerminalNumber = session.nextTerminalNumber
        state.nextGroupNumber = session.nextGroupNumber
        state.sidebarCollapsed = session.sidebarCollapsed ?? false
        state.titleBarVisible = session.titleBarVisible ?? true
        state.restoreScrollback = session.restoreScrollback ?? false
        state.globalFontSize = session.globalFontSize ?? DEFAULT_FONT_SIZE
        state.globalComposeBar = session.globalComposeBar ?? true
      })
    }
  }))
)
