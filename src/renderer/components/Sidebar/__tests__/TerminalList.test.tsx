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
    terminal: { id: string; title: string }
    isActive: boolean
  }) => (
    <div data-testid={`item-${terminal.id}`} data-active={isActive}>
      {terminal.title}
    </div>
  )
}))

describe('TerminalList', () => {
  beforeEach(() => {
    useTerminalStore.setState({ terminals: {}, activeTerminalId: null })
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
          title: 'Second',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 200
        },
        a: {
          id: 'a',
          title: 'First',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 100
        },
        c: {
          id: 'c',
          title: 'Third',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 300
        }
      },
      activeTerminalId: 'a'
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
          title: 'X',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 100
        },
        y: {
          id: 'y',
          title: 'Y',
          shell: '',
          cwd: '',
          isAlive: true,
          createdAt: 200
        }
      },
      activeTerminalId: 'y'
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
    const id = useTerminalStore.getState().addTerminal()
    const { rerender } = render(<TerminalList />)
    expect(screen.queryAllByTestId(/^item-/)).toHaveLength(1)

    useTerminalStore.getState().removeTerminal(id)
    rerender(<TerminalList />)
    expect(screen.queryAllByTestId(/^item-/)).toHaveLength(0)
  })
})
