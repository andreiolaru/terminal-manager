import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from '../terminal-store'

const store = () => useTerminalStore.getState()

describe('terminal-store', () => {
  beforeEach(() => {
    useTerminalStore.setState({ terminals: {}, activeTerminalId: null })
  })

  describe('addTerminal', () => {
    it('creates a terminal with correct defaults', () => {
      const id = store().addTerminal()
      const terminal = store().terminals[id]

      expect(terminal).toBeDefined()
      expect(terminal.id).toBe(id)
      expect(terminal.title).toBe('Terminal 1')
      expect(terminal.shell).toBe('powershell.exe')
      expect(terminal.isAlive).toBe(true)
      expect(terminal.createdAt).toBeGreaterThan(0)
    })

    it('returns a valid UUID', () => {
      const id = store().addTerminal()
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('sets the new terminal as active', () => {
      const id = store().addTerminal()
      expect(store().activeTerminalId).toBe(id)
    })

    it('auto-increments titles', () => {
      store().addTerminal()
      store().addTerminal()
      const id3 = store().addTerminal()

      const titles = Object.values(store().terminals).map((t) => t.title)
      expect(titles).toEqual(['Terminal 1', 'Terminal 2', 'Terminal 3'])
      expect(store().activeTerminalId).toBe(id3)
    })

    it('counts titles based on current terminal count, not historical', () => {
      const id1 = store().addTerminal() // Terminal 1
      store().addTerminal() // Terminal 2
      store().removeTerminal(id1)
      store().addTerminal() // Terminal 2 (1 existing when added)

      const titles = Object.values(store().terminals)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((t) => t.title)
      expect(titles).toEqual(['Terminal 2', 'Terminal 2'])
    })
  })

  describe('removeTerminal', () => {
    it('removes the terminal from the map', () => {
      const id = store().addTerminal()
      store().removeTerminal(id)
      expect(store().terminals[id]).toBeUndefined()
    })

    it('reassigns active to last remaining when active is removed', () => {
      const id1 = store().addTerminal()
      store().addTerminal()
      store().setActiveTerminal(id1)

      store().removeTerminal(id1)
      expect(store().activeTerminalId).not.toBe(id1)
      expect(store().activeTerminalId).toBeTruthy()
    })

    it('sets activeTerminalId to null when last terminal is removed', () => {
      const id = store().addTerminal()
      store().removeTerminal(id)
      expect(store().activeTerminalId).toBeNull()
    })

    it('does not change active if a non-active terminal is removed', () => {
      store().addTerminal()
      const id2 = store().addTerminal()
      // id2 is active after addTerminal
      const firstId = Object.values(store().terminals).find(
        (t) => t.id !== id2
      )!.id

      store().removeTerminal(firstId)
      expect(store().activeTerminalId).toBe(id2)
    })

    it('is a no-op for non-existent ID', () => {
      store().addTerminal()
      const before = { ...store().terminals }
      store().removeTerminal('non-existent-id')
      expect(store().terminals).toEqual(before)
    })
  })

  describe('setActiveTerminal', () => {
    it('sets the active terminal', () => {
      const id1 = store().addTerminal()
      store().addTerminal()

      store().setActiveTerminal(id1)
      expect(store().activeTerminalId).toBe(id1)
    })

    it('is a no-op for non-existent ID', () => {
      const id = store().addTerminal()
      store().setActiveTerminal('non-existent')
      expect(store().activeTerminalId).toBe(id)
    })
  })

  describe('renameTerminal', () => {
    it('updates the title', () => {
      const id = store().addTerminal()
      store().renameTerminal(id, 'My Shell')
      expect(store().terminals[id].title).toBe('My Shell')
    })

    it('is a no-op for non-existent ID', () => {
      const id = store().addTerminal()
      store().renameTerminal('non-existent', 'New Title')
      expect(store().terminals[id].title).toBe('Terminal 1')
    })
  })

  describe('setTerminalDead', () => {
    it('sets isAlive to false', () => {
      const id = store().addTerminal()
      store().setTerminalDead(id)
      expect(store().terminals[id].isAlive).toBe(false)
    })

    it('is a no-op for non-existent ID', () => {
      const id = store().addTerminal()
      store().setTerminalDead('non-existent')
      expect(store().terminals[id].isAlive).toBe(true)
    })
  })

  describe('complex sequences', () => {
    it('handles add 3, remove middle, verify consistency', () => {
      const id1 = store().addTerminal()
      const id2 = store().addTerminal()
      const id3 = store().addTerminal()

      store().removeTerminal(id2)

      expect(Object.keys(store().terminals)).toHaveLength(2)
      expect(store().terminals[id1]).toBeDefined()
      expect(store().terminals[id2]).toBeUndefined()
      expect(store().terminals[id3]).toBeDefined()
      expect(store().activeTerminalId).toBe(id3)
    })

    it('handles rename then remove', () => {
      const id = store().addTerminal()
      store().renameTerminal(id, 'Custom')
      expect(store().terminals[id].title).toBe('Custom')
      store().removeTerminal(id)
      expect(store().terminals[id]).toBeUndefined()
    })

    it('handles setDead then remove', () => {
      const id = store().addTerminal()
      store().setTerminalDead(id)
      expect(store().terminals[id].isAlive).toBe(false)
      store().removeTerminal(id)
      expect(store().activeTerminalId).toBeNull()
    })
  })
})
