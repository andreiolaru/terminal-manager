import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from '../terminal-store'

const store = () => useTerminalStore.getState()

describe('terminal-store', () => {
  beforeEach(() => {
    useTerminalStore.setState({ terminals: {}, activeTerminalId: null, nextTerminalNumber: 1, splitTree: null })
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

    it('uses monotonic counter so titles never repeat after removal', () => {
      const id1 = store().addTerminal() // Terminal 1
      store().addTerminal() // Terminal 2
      store().removeTerminal(id1)
      store().addTerminal() // Terminal 3 (counter keeps incrementing)

      const titles = Object.values(store().terminals)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((t) => t.title)
      expect(titles).toEqual(['Terminal 2', 'Terminal 3'])
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

  describe('splitTree integration', () => {
    it('addTerminal sets splitTree to a leaf when tree is null', () => {
      const id = store().addTerminal()
      expect(store().splitTree).toEqual({ type: 'leaf', terminalId: id })
    })

    it('addTerminal does not modify splitTree when tree already exists', () => {
      const id1 = store().addTerminal()
      store().addTerminal()
      // Tree should still be the original single leaf
      expect(store().splitTree).toEqual({ type: 'leaf', terminalId: id1 })
    })

    it('removeTerminal updates splitTree', () => {
      const id = store().addTerminal()
      store().removeTerminal(id)
      expect(store().splitTree).toBeNull()
    })

    it('removeTerminal collapses branch to surviving sibling', () => {
      const id1 = store().addTerminal()
      store().splitTerminal(id1, 'horizontal')
      const ids = Object.keys(store().terminals)
      const id2 = ids.find((i) => i !== id1)!

      store().removeTerminal(id1)
      expect(store().splitTree).toEqual({ type: 'leaf', terminalId: id2 })
    })
  })

  describe('splitTerminal', () => {
    it('splits a terminal horizontally', () => {
      const id1 = store().addTerminal()
      store().splitTerminal(id1, 'horizontal')

      const tree = store().splitTree
      expect(tree?.type).toBe('branch')
      if (tree?.type === 'branch') {
        expect(tree.direction).toBe('horizontal')
        expect(tree.first).toEqual({ type: 'leaf', terminalId: id1 })
        expect(tree.second.type).toBe('leaf')
        expect(tree.ratio).toBe(0.5)
      }
    })

    it('splits a terminal vertically', () => {
      const id1 = store().addTerminal()
      store().splitTerminal(id1, 'vertical')

      const tree = store().splitTree
      expect(tree?.type).toBe('branch')
      if (tree?.type === 'branch') {
        expect(tree.direction).toBe('vertical')
      }
    })

    it('creates a new terminal in the store', () => {
      const id1 = store().addTerminal()
      store().splitTerminal(id1, 'horizontal')
      expect(Object.keys(store().terminals)).toHaveLength(2)
    })

    it('sets the new terminal as active', () => {
      const id1 = store().addTerminal()
      store().splitTerminal(id1, 'horizontal')
      expect(store().activeTerminalId).not.toBe(id1)
    })

    it('is a no-op for non-existent terminal ID', () => {
      store().addTerminal()
      const treeBefore = store().splitTree
      store().splitTerminal('non-existent', 'horizontal')
      expect(store().splitTree).toEqual(treeBefore)
      expect(Object.keys(store().terminals)).toHaveLength(1)
    })

    it('supports nested splits', () => {
      const id1 = store().addTerminal()
      store().splitTerminal(id1, 'horizontal')
      const tree1 = store().splitTree
      const id2 = tree1?.type === 'branch'
        ? (tree1.second as { type: 'leaf'; terminalId: string }).terminalId
        : ''

      store().splitTerminal(id2, 'vertical')
      const tree2 = store().splitTree
      expect(tree2?.type).toBe('branch')
      if (tree2?.type === 'branch') {
        expect(tree2.second.type).toBe('branch')
        if (tree2.second.type === 'branch') {
          expect(tree2.second.direction).toBe('vertical')
        }
      }
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
