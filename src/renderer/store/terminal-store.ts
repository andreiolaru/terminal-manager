import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type { TerminalState, TerminalGroup } from './types'
import { DEFAULT_SHELL } from '../lib/constants'
import { destroyPtySafe } from '../lib/ipc-api'
import { splitNode as splitTreeNode, removeNode, collectLeafIds, containsLeaf } from '../lib/tree-utils'

function findGroupForTerminal(groups: TerminalGroup[], terminalId: string): TerminalGroup | undefined {
  return groups.find((g) => containsLeaf(g.splitTree, terminalId))
}

export const useTerminalStore = create<TerminalState>()(
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
    }
  }))
)
