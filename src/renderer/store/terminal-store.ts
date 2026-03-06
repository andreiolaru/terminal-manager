import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type { TerminalState } from './types'
import { DEFAULT_SHELL } from '../lib/constants'
import { splitNode as splitTreeNode, removeNode } from '../lib/tree-utils'

export const useTerminalStore = create<TerminalState>()(
  immer((set) => ({
    terminals: {},
    activeTerminalId: null,
    nextTerminalNumber: 1,
    splitTree: null,

    addTerminal: (): string => {
      const id = uuid()
      const now = Date.now()
      set((state) => {
        state.terminals[id] = {
          id,
          title: `Terminal ${state.nextTerminalNumber}`,
          shell: DEFAULT_SHELL,
          cwd: '',
          isAlive: true,
          createdAt: now
        }
        state.activeTerminalId = id
        state.nextTerminalNumber++
        if (state.splitTree === null) {
          state.splitTree = { type: 'leaf', terminalId: id }
        }
      })
      return id
    },

    removeTerminal: (id): void => {
      set((state) => {
        delete state.terminals[id]
        if (state.splitTree) {
          const newTree = removeNode(state.splitTree, id)
          state.splitTree = newTree ?? null
        }
        if (state.activeTerminalId === id) {
          const remaining = Object.keys(state.terminals)
          state.activeTerminalId = remaining.length > 0 ? remaining[remaining.length - 1] : null
        }
      })
    },

    splitTerminal: (id, direction): void => {
      const newId = uuid()
      const now = Date.now()
      set((state) => {
        if (!state.terminals[id] || !state.splitTree) return

        state.terminals[newId] = {
          id: newId,
          title: `Terminal ${state.nextTerminalNumber}`,
          shell: DEFAULT_SHELL,
          cwd: '',
          isAlive: true,
          createdAt: now
        }
        state.nextTerminalNumber++
        state.splitTree = splitTreeNode(state.splitTree!, id, direction, newId)
        state.activeTerminalId = newId
      })
    },

    setActiveTerminal: (id): void => {
      set((state) => {
        if (state.terminals[id]) {
          state.activeTerminalId = id
        }
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
