import { describe, it, expect } from 'vitest'
import { splitNode, removeNode, collectLeafIds, containsLeaf, findAdjacentTerminal } from '../tree-utils'
import type { SplitNode } from '../../store/types'

const leaf = (id: string): SplitNode => ({ type: 'leaf', terminalId: id })

describe('tree-utils', () => {
  describe('splitNode', () => {
    it('splits a single leaf into a branch', () => {
      const tree = leaf('a')
      const result = splitNode(tree, 'a', 'horizontal', 'b')

      expect(result).toEqual({
        type: 'branch',
        direction: 'horizontal',
        first: { type: 'leaf', terminalId: 'a' },
        second: { type: 'leaf', terminalId: 'b' },
        ratio: 0.5
      })
    })

    it('splits a nested leaf', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }

      const result = splitNode(tree, 'b', 'vertical', 'c')

      expect(result.type).toBe('branch')
      if (result.type === 'branch') {
        expect(result.first).toEqual(leaf('a'))
        expect(result.second).toEqual({
          type: 'branch',
          direction: 'vertical',
          first: leaf('b'),
          second: leaf('c'),
          ratio: 0.5
        })
      }
    })

    it('returns same tree reference if target not found', () => {
      const tree = leaf('a')
      const result = splitNode(tree, 'nonexistent', 'horizontal', 'b')
      expect(result).toBe(tree)
    })

    it('returns same branch reference if target not found in branch', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }
      const result = splitNode(tree, 'nonexistent', 'horizontal', 'c')
      expect(result).toBe(tree)
    })
  })

  describe('removeNode', () => {
    it('returns null when removing the only leaf', () => {
      const result = removeNode(leaf('a'), 'a')
      expect(result).toBeNull()
    })

    it('returns sibling when removing from a branch', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }

      expect(removeNode(tree, 'a')).toEqual(leaf('b'))
      expect(removeNode(tree, 'b')).toEqual(leaf('a'))
    })

    it('collapses nested branches correctly', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: {
          type: 'branch',
          direction: 'vertical',
          first: leaf('b'),
          second: leaf('c'),
          ratio: 0.5
        },
        ratio: 0.5
      }

      const result = removeNode(tree, 'b')
      expect(result).toEqual({
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('c'),
        ratio: 0.5
      })
    })

    it('returns same tree reference if target not found', () => {
      const tree = leaf('a')
      const result = removeNode(tree, 'nonexistent')
      expect(result).toBe(tree)
    })

    it('handles removal in a 3-level deep tree', () => {
      // a | (b / (c | d))
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: {
          type: 'branch',
          direction: 'vertical',
          first: leaf('b'),
          second: {
            type: 'branch',
            direction: 'horizontal',
            first: leaf('c'),
            second: leaf('d'),
            ratio: 0.5
          },
          ratio: 0.5
        },
        ratio: 0.5
      }

      // Remove 'c' — deepest level collapses, 'd' replaces the inner branch
      const result = removeNode(tree, 'c')
      expect(result).toEqual({
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: {
          type: 'branch',
          direction: 'vertical',
          first: leaf('b'),
          second: leaf('d'),
          ratio: 0.5
        },
        ratio: 0.5
      })
    })
  })

  describe('collectLeafIds', () => {
    it('returns single ID for a leaf', () => {
      expect(collectLeafIds(leaf('a'))).toEqual(['a'])
    })

    it('returns all IDs from a branch tree', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: {
          type: 'branch',
          direction: 'vertical',
          first: leaf('b'),
          second: leaf('c'),
          ratio: 0.5
        },
        ratio: 0.5
      }
      expect(collectLeafIds(tree)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('findAdjacentTerminal', () => {
    it('returns null for a single leaf', () => {
      expect(findAdjacentTerminal(leaf('a'), 'a', 'left')).toBeNull()
      expect(findAdjacentTerminal(leaf('a'), 'a', 'right')).toBeNull()
      expect(findAdjacentTerminal(leaf('a'), 'a', 'up')).toBeNull()
      expect(findAdjacentTerminal(leaf('a'), 'a', 'down')).toBeNull()
    })

    it('returns null if currentId not found', () => {
      expect(findAdjacentTerminal(leaf('a'), 'x', 'left')).toBeNull()
    })

    it('navigates right in a horizontal split', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }
      expect(findAdjacentTerminal(tree, 'a', 'right')).toBe('b')
    })

    it('navigates left in a horizontal split', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }
      expect(findAdjacentTerminal(tree, 'b', 'left')).toBe('a')
    })

    it('returns null at boundary', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }
      expect(findAdjacentTerminal(tree, 'a', 'left')).toBeNull()
      expect(findAdjacentTerminal(tree, 'b', 'right')).toBeNull()
    })

    it('returns null for perpendicular direction', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }
      expect(findAdjacentTerminal(tree, 'a', 'up')).toBeNull()
      expect(findAdjacentTerminal(tree, 'a', 'down')).toBeNull()
    })

    it('navigates down in a vertical split', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'vertical',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }
      expect(findAdjacentTerminal(tree, 'a', 'down')).toBe('b')
      expect(findAdjacentTerminal(tree, 'b', 'up')).toBe('a')
    })

    it('navigates in a 2x2 grid (all four directions)', () => {
      // Layout:  a | b
      //          -----
      //          c | d
      const topRow: SplitNode = {
        type: 'branch', direction: 'horizontal',
        first: leaf('a'), second: leaf('b'), ratio: 0.5
      }
      const bottomRow: SplitNode = {
        type: 'branch', direction: 'horizontal',
        first: leaf('c'), second: leaf('d'), ratio: 0.5
      }
      const grid: SplitNode = {
        type: 'branch', direction: 'vertical',
        first: topRow, second: bottomRow, ratio: 0.5
      }

      // From 'a': right->b, down->c
      expect(findAdjacentTerminal(grid, 'a', 'right')).toBe('b')
      expect(findAdjacentTerminal(grid, 'a', 'down')).toBe('c')
      expect(findAdjacentTerminal(grid, 'a', 'left')).toBeNull()
      expect(findAdjacentTerminal(grid, 'a', 'up')).toBeNull()

      // From 'd': left->c, up->b
      expect(findAdjacentTerminal(grid, 'd', 'left')).toBe('c')
      expect(findAdjacentTerminal(grid, 'd', 'up')).toBe('b')
      expect(findAdjacentTerminal(grid, 'd', 'right')).toBeNull()
      expect(findAdjacentTerminal(grid, 'd', 'down')).toBeNull()

      // From 'b': left->a, down->c (enters bottom row at first edge)
      expect(findAdjacentTerminal(grid, 'b', 'left')).toBe('a')
      expect(findAdjacentTerminal(grid, 'b', 'down')).toBe('c')

      // From 'c': right->d, up->b (enters top row at last edge)
      expect(findAdjacentTerminal(grid, 'c', 'right')).toBe('d')
      expect(findAdjacentTerminal(grid, 'c', 'up')).toBe('b')
    })

    it('drills to nearest edge leaf in deep subtree', () => {
      // Layout: a | (b / c) — navigate right from 'a' should reach 'b' (top of right side)
      const tree: SplitNode = {
        type: 'branch', direction: 'horizontal',
        first: leaf('a'),
        second: {
          type: 'branch', direction: 'vertical',
          first: leaf('b'), second: leaf('c'), ratio: 0.5
        },
        ratio: 0.5
      }
      expect(findAdjacentTerminal(tree, 'a', 'right')).toBe('b')
    })
  })

  describe('containsLeaf', () => {
    it('returns true when leaf exists', () => {
      expect(containsLeaf(leaf('a'), 'a')).toBe(true)
    })

    it('returns false when leaf does not exist', () => {
      expect(containsLeaf(leaf('a'), 'b')).toBe(false)
    })

    it('finds leaf in nested branch', () => {
      const tree: SplitNode = {
        type: 'branch',
        direction: 'horizontal',
        first: leaf('a'),
        second: leaf('b'),
        ratio: 0.5
      }
      expect(containsLeaf(tree, 'b')).toBe(true)
      expect(containsLeaf(tree, 'c')).toBe(false)
    })
  })
})
