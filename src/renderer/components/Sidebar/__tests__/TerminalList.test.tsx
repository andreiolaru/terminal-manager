import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TerminalList from '../TerminalList'
import { useTerminalStore } from '../../../store/terminal-store'

// Mock TerminalListItem to isolate list behavior
vi.mock('../TerminalListItem', () => ({
  default: ({
    terminal,
    isActive
  }: {
    terminal: { id: string; name: string }
    isActive: boolean
  }) => (
    <div data-testid={`item-${terminal.id}`} data-active={isActive}>
      {terminal.name}
    </div>
  )
}))

describe('TerminalList', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      terminals: {},
      groups: [],
      activeGroupId: null,
      nextTerminalNumber: 1,
      nextGroupNumber: 1
    })
  })

  it('renders no items when store is empty', () => {
    const { container } = render(<TerminalList />)
    expect(container.querySelector('.terminal-list')?.children).toHaveLength(0)
  })

  it('renders terminals sorted by createdAt (oldest first)', () => {
    useTerminalStore.setState({
      terminals: {
        b: {
          id: 'b',
          name: 'Second',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 200
        },
        a: {
          id: 'a',
          name: 'First',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 100
        },
        c: {
          id: 'c',
          name: 'Third',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 300
        }
      },
      groups: [
        {
          id: 'g1',
          label: 'Group 1',
          splitTree: {
            type: 'branch',
            direction: 'horizontal',
            first: {
              type: 'branch',
              direction: 'horizontal',
              first: { type: 'leaf', terminalId: 'a' },
              second: { type: 'leaf', terminalId: 'b' },
              ratio: 0.5
            },
            second: { type: 'leaf', terminalId: 'c' },
            ratio: 0.5
          },
          activeTerminalId: 'a'
        }
      ],
      activeGroupId: 'g1'
    })

    render(<TerminalList />)
    const items = screen.getAllByTestId(/^item-/)
    expect(items[0]).toHaveTextContent('First')
    expect(items[1]).toHaveTextContent('Second')
    expect(items[2]).toHaveTextContent('Third')
  })

  it('passes isActive=true only to the active terminal', () => {
    useTerminalStore.setState({
      terminals: {
        x: {
          id: 'x',
          name: 'X',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 100
        },
        y: {
          id: 'y',
          name: 'Y',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 200
        }
      },
      groups: [
        {
          id: 'g1',
          label: 'Group 1',
          splitTree: {
            type: 'branch',
            direction: 'horizontal',
            first: { type: 'leaf', terminalId: 'x' },
            second: { type: 'leaf', terminalId: 'y' },
            ratio: 0.5
          },
          activeTerminalId: 'y'
        }
      ],
      activeGroupId: 'g1'
    })

    render(<TerminalList />)
    expect(screen.getByTestId('item-x')).toHaveAttribute(
      'data-active',
      'false'
    )
    expect(screen.getByTestId('item-y')).toHaveAttribute('data-active', 'true')
  })

  it('re-renders when a terminal is added to the store', () => {
    const { rerender } = render(<TerminalList />)
    expect(screen.queryAllByTestId(/^item-/)).toHaveLength(0)

    useTerminalStore.getState().addTerminal()
    // Zustand triggers re-render synchronously
    rerender(<TerminalList />)
    expect(screen.queryAllByTestId(/^item-/)).toHaveLength(1)
  })

  it('re-renders without removed terminal', () => {
    useTerminalStore.getState().addGroup()
    const s = useTerminalStore.getState()
    const group = s.groups.find((g) => g.id === s.activeGroupId)!
    const id = group.activeTerminalId

    const { rerender } = render(<TerminalList />)
    expect(screen.queryAllByTestId(/^item-/)).toHaveLength(1)

    useTerminalStore.getState().removeTerminal(id)
    rerender(<TerminalList />)
    expect(screen.queryAllByTestId(/^item-/)).toHaveLength(0)
  })
})
