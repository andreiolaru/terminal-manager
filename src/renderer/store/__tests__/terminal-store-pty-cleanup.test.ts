import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/ipc-api', () => ({
  ipcApi: undefined,
  destroyPtySafe: vi.fn(),
}))

import { useTerminalStore } from '../terminal-store'
import { destroyPtySafe } from '../../lib/ipc-api'

const mockDestroyPtySafe = vi.mocked(destroyPtySafe)
const store = () => useTerminalStore.getState()
const activeGroup = () => {
  const s = store()
  return s.groups.find((g) => g.id === s.activeGroupId)
}

describe('terminal-store PTY cleanup (C3/C4)', () => {
  beforeEach(() => {
    mockDestroyPtySafe.mockClear()
    useTerminalStore.setState({
      terminals: {},
      groups: [],
      activeGroupId: null,
      nextTerminalNumber: 1,
      nextGroupNumber: 1
    })
  })

  describe('removeGroup', () => {
    it('calls destroyPtySafe for every terminal in the group', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().splitTerminal(id1, 'horizontal')
      const id2 = activeGroup()!.activeTerminalId

      store().removeGroup(store().activeGroupId!)

      expect(mockDestroyPtySafe).toHaveBeenCalledTimes(2)
      expect(mockDestroyPtySafe).toHaveBeenCalledWith(id1)
      expect(mockDestroyPtySafe).toHaveBeenCalledWith(id2)
    })

    it('calls destroyPtySafe for single-terminal group', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId

      store().removeGroup(store().activeGroupId!)

      expect(mockDestroyPtySafe).toHaveBeenCalledOnce()
      expect(mockDestroyPtySafe).toHaveBeenCalledWith(id)
    })

    it('does not call destroyPtySafe for non-existent group', () => {
      store().removeGroup('non-existent')
      expect(mockDestroyPtySafe).not.toHaveBeenCalled()
    })

    it('destroys PTYs even when group is not active', () => {
      const g1 = store().addGroup()
      const g1Term = activeGroup()!.activeTerminalId
      store().addGroup() // switches active to g2

      store().removeGroup(g1)

      expect(mockDestroyPtySafe).toHaveBeenCalledOnce()
      expect(mockDestroyPtySafe).toHaveBeenCalledWith(g1Term)
    })
  })

  describe('removeTerminal', () => {
    it('calls destroyPtySafe for the removed terminal', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      store().addTerminal() // second terminal so group survives

      store().removeTerminal(id1)

      expect(mockDestroyPtySafe).toHaveBeenCalledOnce()
      expect(mockDestroyPtySafe).toHaveBeenCalledWith(id1)
    })

    it('calls destroyPtySafe when last terminal removed (group collapses)', () => {
      store().addGroup()
      const id = activeGroup()!.activeTerminalId

      store().removeTerminal(id)

      expect(mockDestroyPtySafe).toHaveBeenCalledOnce()
      expect(mockDestroyPtySafe).toHaveBeenCalledWith(id)
    })

    it('does not call destroyPtySafe for non-existent terminal', () => {
      store().removeTerminal('non-existent')
      expect(mockDestroyPtySafe).not.toHaveBeenCalled()
    })

    it('only destroys the specific terminal, not siblings', () => {
      store().addGroup()
      const id1 = activeGroup()!.activeTerminalId
      const id2 = store().addTerminal()
      const id3 = store().addTerminal()

      store().removeTerminal(id2)

      expect(mockDestroyPtySafe).toHaveBeenCalledOnce()
      expect(mockDestroyPtySafe).toHaveBeenCalledWith(id2)
      // id1 and id3 should still exist
      expect(store().terminals[id1]).toBeDefined()
      expect(store().terminals[id3]).toBeDefined()
    })
  })
})
