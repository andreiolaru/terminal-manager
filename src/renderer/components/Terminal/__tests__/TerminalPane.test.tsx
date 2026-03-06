import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTerminalStore } from '../../../store/terminal-store'

// Mock TerminalInstance to avoid xterm/addon complexity
vi.mock('../TerminalInstance', () => ({
  default: ({ terminalId }: { terminalId: string }) => (
    <div data-testid={`terminal-instance-${terminalId}`} />
  )
}))

vi.mock('../../../assets/styles/splitpane.css', () => ({}))

import TerminalPane from '../TerminalPane'

describe('TerminalPane', () => {
  let mockSplit: ReturnType<typeof vi.fn>
  let mockRemove: ReturnType<typeof vi.fn>
  let mockSetActive: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSplit = vi.fn()
    mockRemove = vi.fn()
    mockSetActive = vi.fn()

    useTerminalStore.setState({
      terminals: {
        't1': {
          id: 't1',
          title: 'My Terminal',
          shell: 'powershell.exe',
          cwd: '',
          isAlive: true,
          createdAt: Date.now()
        }
      },
      groups: [
        {
          id: 'g1',
          label: 'Group 1',
          splitTree: { type: 'leaf', terminalId: 't1' },
          activeTerminalId: 't1'
        }
      ],
      activeGroupId: 'g1',
      splitTerminal: mockSplit as unknown as (id: string, dir: 'horizontal' | 'vertical') => void,
      removeTerminal: mockRemove as unknown as (id: string) => void,
      setActiveTerminal: mockSetActive as unknown as (id: string) => void
    })
  })

  it('renders terminal title in the title bar', () => {
    render(<TerminalPane terminalId="t1" groupId="g1" />)
    expect(screen.getByText('My Terminal')).toBeInTheDocument()
  })

  it('renders TerminalInstance with correct terminalId', () => {
    render(<TerminalPane terminalId="t1" groupId="g1" />)
    expect(screen.getByTestId('terminal-instance-t1')).toBeInTheDocument()
  })

  it('has .active class when terminal is active', () => {
    const { container } = render(<TerminalPane terminalId="t1" groupId="g1" />)
    expect(container.firstChild).toHaveClass('active')
  })

  it('does not have .active class when terminal is not active', () => {
    useTerminalStore.setState({
      groups: [
        {
          id: 'g1',
          label: 'Group 1',
          splitTree: { type: 'leaf', terminalId: 't1' },
          activeTerminalId: 'other-id'
        }
      ]
    })
    const { container } = render(<TerminalPane terminalId="t1" groupId="g1" />)
    expect(container.firstChild).not.toHaveClass('active')
  })

  it('Split Right calls splitTerminal with horizontal', async () => {
    const user = userEvent.setup()
    render(<TerminalPane terminalId="t1" groupId="g1" />)
    await user.click(screen.getByLabelText('Split Right'))
    expect(mockSplit).toHaveBeenCalledWith('t1', 'horizontal')
  })

  it('Split Down calls splitTerminal with vertical', async () => {
    const user = userEvent.setup()
    render(<TerminalPane terminalId="t1" groupId="g1" />)
    await user.click(screen.getByLabelText('Split Down'))
    expect(mockSplit).toHaveBeenCalledWith('t1', 'vertical')
  })

  it('Close button calls removeTerminal', async () => {
    const user = userEvent.setup()
    render(<TerminalPane terminalId="t1" groupId="g1" />)
    await user.click(screen.getByLabelText('Close terminal'))
    expect(mockRemove).toHaveBeenCalledWith('t1')
  })

  it('mouseDown on pane calls setActiveTerminal', async () => {
    const user = userEvent.setup()
    useTerminalStore.setState({
      groups: [
        {
          id: 'g1',
          label: 'Group 1',
          splitTree: { type: 'leaf', terminalId: 't1' },
          activeTerminalId: 'other-id'
        }
      ]
    })
    const { container } = render(<TerminalPane terminalId="t1" groupId="g1" />)
    await user.pointer({ keys: '[MouseLeft>]', target: container.firstChild as Element })
    expect(mockSetActive).toHaveBeenCalledWith('t1')
  })
})
