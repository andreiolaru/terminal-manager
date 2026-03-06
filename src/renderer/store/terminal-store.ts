import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type { TerminalState, TerminalGroup, NavigationDirection } from './types'
import type { LayoutTemplate } from '../../shared/template-types'
import { DEFAULT_SHELL } from '../lib/constants'
import { destroyPtySafe } from '../lib/ipc-api'
import { splitNode as splitTreeNode, removeNode, collectLeafIds, containsLeaf, findAdjacentTerminal } from '../lib/tree-utils'
import { instantiateLayoutNode } from '../lib/template-utils'

function findGroupForTerminal(groups: TerminalGroup[], terminalId: string): TerminalGroup | undefined {
  return groups.find((g) => containsLeaf(g.splitTree, terminalId))
}

// No-op storage — scaffold for future session persistence
const noopStorage = createJSONStorage(() => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}))

export const useTerminalStore = create<TerminalState>()(
  persist(
  immer((set) => ({
    terminals: {},
    groups: [],
    activeGroupId: null,
    nextTerminalNumber: 1,
    nextGroupNumber: 1,

    addGroup: (): string => {
      const groupId = uuid()
      const terminalId = uuid()
      const now = Date.now()
      set((state) => {
        state.terminals[terminalId] = {
          id: terminalId,
          title: `Terminal ${state.nextTerminalNumber}`,
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
          title: `Terminal ${state.nextTerminalNumber}`,
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
          title: `Terminal ${state.nextTerminalNumber}`,
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

    renameTerminal: (id, title): void => {
      set((state) => {
        if (state.terminals[id]) {
          state.terminals[id].title = title
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
        }
      })
    }
  })),
  {
    name: 'terminal-manager-state',
    storage: noopStorage,
    partialize: (state) => ({
      nextTerminalNumber: state.nextTerminalNumber,
      nextGroupNumber: state.nextGroupNumber
    })
  }
  )
)
