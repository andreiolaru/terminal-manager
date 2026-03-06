import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type { TerminalState } from './types'
import { DEFAULT_SHELL } from '../lib/constants'

export const useTerminalStore = create<TerminalState>()(
  immer((set) => ({
    terminals: {},
    activeTerminalId: null,

    addTerminal: (): string => {
      const id = uuid()
      const now = Date.now()
      set((state) => {
        state.terminals[id] = {
          id,
          title: `Terminal ${Object.keys(state.terminals).length + 1}`,
          shell: DEFAULT_SHELL,
          cwd: '',
          isAlive: true,
          createdAt: now
        }
        state.activeTerminalId = id
      })
      return id
    },

    removeTerminal: (id): void => {
      set((state) => {
        delete state.terminals[id]
        if (state.activeTerminalId === id) {
          const remaining = Object.keys(state.terminals)
          state.activeTerminalId = remaining.length > 0 ? remaining[remaining.length - 1] : null
        }
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
