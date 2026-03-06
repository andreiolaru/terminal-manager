import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from '../terminal-store'

const store = () => useTerminalStore.getState()
const activeGroup = () => {
  const s = store()
  return s.groups.find((g) => g.id === s.activeGroupId)
}

describe('terminal-store', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      terminals: {},
      groups: [],
      activeGroupId: null,
      nextTerminalNumber: 1,
      nextGroupNumber: 1
    })
  })

  describe('addGroup', () => {
    it('creates a group with one terminal', () => {
      const groupId = store().addGroup()
      const group = store().groups.find((g) => g.id === groupId)

      expect(group).toBeDefined()
      expect(group!.label).toBe('Group 1')
      expect(group!.splitTree.type).toBe('leaf')
      expect(Object.keys(store().terminals)).toHaveLength(1)
    })

    it('sets the new group as active', () => {
      const groupId = store().addGroup()
      expect(store().activeGroupId).toBe(groupId)
    })

    it('auto-increments group labels', () => {
      store().addGroup()
      store().addGroup()
      store().addGroup()

      const labels = store().groups.map((g) => g.label)
      expect(labels).toEqual(['Group 1', 'Group 2', 'Group 3'])
    })

    it('creates independent groups', () => {
      store().addGroup()
      store().addGroup()

      expect(store().groups).toHaveLength(2)
      expect(Object.keys(store().terminals)).toHaveLength(2)

      const tree1 = store().groups[0].splitTree
      const tree2 = store().groups[1].splitTree
      expect(tree1.type).toBe('leaf')
      expect(tree2.type).toBe('leaf')
      if (tree1.type === 'leaf' && tree2.type === 'leaf') {
        expect(tree1.terminalId).not.toBe(tree2.terminalId)
      }
    })
  })

  describe('removeGroup', () => {
    it('removes the group and its terminals', () => {
      const groupId = store().addGroup()
      store().removeGroup(groupId)

      expect(store().groups).toHaveLength(0)
      expect(Object.keys(store().terminals)).toHaveLength(0)
      expect(store().activeGroupId).toBeNull()
    })

    it('switches active to adjacent group', () => {
      const g1 = store().addGroup()
      const g2 = store().addGroup()
      store().addGroup()

      store().removeGroup(g2)
      // Should switch to the group at the same index (g3) or previous
      expect(store().activeGroupId).not.toBe(g2)
      expect(store().groups).toHaveLength(2)
    })

    it('switches active to previous when last tab removed', () => {
      const g1 = store().addGroup()
      store().addGroup()
      const g3 = store().addGroup()

      store().removeGroup(g3)
      expect(store().groups).toHaveLength(2)
      expect(store().activeGroupId).not.toBe(g3)
    })

    it('is a no-op for non-existent group', () => {
      store().addGroup()
      const before = store().groups.length
      store().removeGroup('non-existent')
      expect(store().groups).toHaveLength(before)
    })

    it('removes group with split terminals', () => {
      store().addGroup()
      const termId = activeGroup()!.activeTerminalId
      store().splitTerminal(termId, 'horizontal')
      expect(Object.keys(store().terminals)).toHaveLength(2)

      store().removeGroup(store().activeGroupId!)
      expect(store().groups).toHaveLength(0)
      expect(Object.keys(store().terminals)).toHaveLength(0)
    })
  })

  describe('setActiveGroup', () => {
    it('switches the active group', () => {
      const g1 = store().addGroup()
      store().addGroup()

      store().setActiveGroup(g1)
      expect(store().activeGroupId).toBe(g1)
    })

    it('is a no-op for non-existent group', () => {
      const g1 = store().addGroup()
      store().setActiveGroup('non-existent')
      expect(store().activeGroupId).toBe(g1)
    })
  })

  describe('renameGroup', () => {
    it('updates the group label', () => {
      const groupId = store().addGroup()
      store().renameGroup(groupId, 'Frontend')
      expect(store().groups.find((g) => g.id === groupId)!.label).toBe('Frontend')
    })

    it('is a no-op for non-existent group', () => {
      store().addGroup()
      store().renameGroup('non-existent', 'Test')
      expect(store().groups[0].label).toBe('Group 1')
    })
  })

  describe('addTerminal', () => {
    it('creates a terminal in the active group', () => {
      store().addGroup() // Group with Terminal 1
      const id = store().addTerminal() // Terminal 2, splits into active group

      expect(store().terminals[id]).toBeDefined()
      expect(store().terminals[id].title).toBe('Terminal 2')
      expect(activeGroup()!.activeTerminalId).toBe(id)
      expect(activeGroup()!.splitTree.type).toBe('branch')
    })

    it('creates a group when none exist', () => {
      const id = store().addTerminal()
      expect(store().groups).toHaveLength(1)
      expect(store().terminals[id]).toBeDefined()
    })

    it('returns a valid UUID', () => {
      store().addGroup()
      const id = store().addTerminal()
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('auto-increments titles across groups', () => {
      store().addGroup() // Terminal 1
      store().addTerminal() // Terminal 2
      store().addGroup() // Terminal 3

      const titles = Object.values(store().terminals)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((t) => t.title)
      expect(titles).toEqual(['Terminal 1', 'Terminal 2', 'Terminal 3'])
    })
  })

  describe('removeTerminal', () => {
    it('removes the terminal from the map', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId
      store().addTerminal() // need a second so group survives
      store().removeTerminal(id)
      expect(store().terminals[id]).toBeUndefined()
    })

    it('removes the group when last terminal is removed', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId
      store().removeTerminal(id)
      expect(store().groups).toHaveLength(0)
      expect(store().activeGroupId).toBeNull()
    })

    it('reassigns activeTerminalId when active is removed', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().addTerminal() // id2 becomes active
      store().removeTerminal(store().activeGroup?.activeTerminalId ?? activeGroup()!.activeTerminalId)
      // Active terminal should be reassigned to remaining
      expect(activeGroup()!.activeTerminalId).toBe(id1)
    })

    it('collapses branch to surviving sibling', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().splitTerminal(id1, 'horizontal')
      const id2 = activeGroup()!.activeTerminalId

      store().removeTerminal(id1)
      expect(activeGroup()!.splitTree).toEqual({ type: 'leaf', terminalId: id2 })
    })

    it('is a no-op for non-existent ID', () => {
      store().addGroup()
      const before = Object.keys(store().terminals).length
      store().removeTerminal('non-existent-id')
      expect(Object.keys(store().terminals)).toHaveLength(before)
    })
  })

  describe('splitTerminal', () => {
    it('splits a terminal horizontally', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().splitTerminal(id1, 'horizontal')

      const tree = activeGroup()!.splitTree
      expect(tree.type).toBe('branch')
      if (tree.type === 'branch') {
        expect(tree.direction).toBe('horizontal')
        expect(tree.first).toEqual({ type: 'leaf', terminalId: id1 })
        expect(tree.second.type).toBe('leaf')
        expect(tree.ratio).toBe(0.5)
      }
    })

    it('splits a terminal vertically', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().splitTerminal(id1, 'vertical')

      const tree = activeGroup()!.splitTree
      expect(tree.type).toBe('branch')
      if (tree.type === 'branch') {
        expect(tree.direction).toBe('vertical')
      }
    })

    it('creates a new terminal in the store', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().splitTerminal(id1, 'horizontal')
      expect(Object.keys(store().terminals)).toHaveLength(2)
    })

    it('sets the new terminal as active', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().splitTerminal(id1, 'horizontal')
      expect(activeGroup()!.activeTerminalId).not.toBe(id1)
    })

    it('is a no-op for non-existent terminal ID', () => {
      store().addGroup()
      const treeBefore = activeGroup()!.splitTree
      store().splitTerminal('non-existent', 'horizontal')
      expect(activeGroup()!.splitTree).toEqual(treeBefore)
      expect(Object.keys(store().terminals)).toHaveLength(1)
    })

    it('supports nested splits', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().splitTerminal(id1, 'horizontal')
      const id2 = activeGroup()!.activeTerminalId

      store().splitTerminal(id2, 'vertical')
      const tree = activeGroup()!.splitTree
      expect(tree.type).toBe('branch')
      if (tree.type === 'branch') {
        expect(tree.second.type).toBe('branch')
        if (tree.second.type === 'branch') {
          expect(tree.second.direction).toBe('vertical')
        }
      }
    })

    it('only affects the owning group', () => {
      store().addGroup() // Group 1
      const g1Id = store().activeGroupId!
      const g1Tree = activeGroup()!.splitTree

      store().addGroup() // Group 2
      const id2 = activeGroup()!.activeTerminalId
      store().splitTerminal(id2, 'horizontal')

      // Group 1's tree should be unchanged
      const g1 = store().groups.find((g) => g.id === g1Id)!
      expect(g1.splitTree).toEqual(g1Tree)
    })
  })

  describe('setActiveTerminal', () => {
    it('sets the active terminal within a group', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().splitTerminal(id1, 'horizontal')

      store().setActiveTerminal(id1)
      expect(activeGroup()!.activeTerminalId).toBe(id1)
    })

    it('auto-switches group when terminal is in a different group', () => {
      store().addGroup()
      const g1Id = store().activeGroupId!
      const g1TermId = activeGroup()!.activeTerminalId

      store().addGroup() // switches to Group 2
      expect(store().activeGroupId).not.toBe(g1Id)

      store().setActiveTerminal(g1TermId)
      expect(store().activeGroupId).toBe(g1Id)
      expect(activeGroup()!.activeTerminalId).toBe(g1TermId)
    })

    it('is a no-op for non-existent ID', () => {
      store().addGroup()
      const before = activeGroup()!.activeTerminalId
      store().setActiveTerminal('non-existent')
      expect(activeGroup()!.activeTerminalId).toBe(before)
    })
  })

  describe('renameTerminal', () => {
    it('updates the title', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId
      store().renameTerminal(id, 'My Shell')
      expect(store().terminals[id].title).toBe('My Shell')
    })

    it('is a no-op for non-existent ID', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId
      store().renameTerminal('non-existent', 'New Title')
      expect(store().terminals[id].title).toBe('Terminal 1')
    })
  })

  describe('setTerminalDead', () => {
    it('sets isAlive to false', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId
      store().setTerminalDead(id)
      expect(store().terminals[id].isAlive).toBe(false)
    })

    it('is a no-op for non-existent ID', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId
      store().setTerminalDead('non-existent')
      expect(store().terminals[id].isAlive).toBe(true)
    })
  })

  describe('complex sequences', () => {
    it('handles add 3 terminals, remove middle, verify consistency', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      const id2 = store().addTerminal()
      const id3 = store().addTerminal()

      store().removeTerminal(id2)

      expect(Object.keys(store().terminals)).toHaveLength(2)
      expect(store().terminals[id1]).toBeDefined()
      expect(store().terminals[id2]).toBeUndefined()
      expect(store().terminals[id3]).toBeDefined()
    })

    it('handles rename then remove', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId
      store().renameTerminal(id, 'Custom')
      expect(store().terminals[id].title).toBe('Custom')
      store().removeTerminal(id)
      expect(store().terminals[id]).toBeUndefined()
    })

    it('handles setDead then remove', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId
      store().setTerminalDead(id)
      expect(store().terminals[id].isAlive).toBe(false)
      store().removeTerminal(id)
      expect(store().activeGroupId).toBeNull()
    })
  })
})
