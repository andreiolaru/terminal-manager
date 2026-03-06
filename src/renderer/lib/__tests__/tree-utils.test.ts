import { describe, it, expect } from 'vitest'
import { splitNode, removeNode, collectLeafIds, containsLeaf } from '../tree-utils'
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
