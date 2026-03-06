import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TerminalListItem from '../TerminalListItem'
import { useTerminalStore } from '../../../store/terminal-store'
import type { TerminalInfo } from '../../../store/types'

const makeTerminal = (overrides?: Partial<TerminalInfo>): TerminalInfo => ({
  id: 'test-id-1',
  name: 'Terminal 1',
  shell: 'powershell.exe',
  cwd: '',
  isAlive: true,
  createdAt: Date.now(),
  ...overrides
})

describe('TerminalListItem', () => {
  let mockSetActive: ReturnType<typeof vi.fn>
  let mockRemove: ReturnType<typeof vi.fn>
  let mockRename: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSetActive = vi.fn()
    mockRemove = vi.fn()
    mockRename = vi.fn()

    useTerminalStore.setState({
      terminals: {},
      setActiveTerminal: mockSetActive as unknown as (id: string) => void,
      removeTerminal: mockRemove as unknown as (id: string) => void,
      renameTerminal: mockRename as unknown as (id: string, title: string) => void
    })
  })

  it('renders terminal title', () => {
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)
    expect(screen.getByText('Terminal 1')).toBeInTheDocument()
  })

  it('calls setActiveTerminal on click', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.click(screen.getByText('Terminal 1'))
    expect(mockSetActive).toHaveBeenCalledWith('test-id-1')
  })

  it('calls removeTerminal on close button click', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.click(screen.getByTitle('Close terminal'))
    expect(mockRemove).toHaveBeenCalledWith('test-id-1')
  })

  it('close button does NOT trigger setActiveTerminal', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.click(screen.getByTitle('Close terminal'))
    expect(mockSetActive).not.toHaveBeenCalled()
  })

  it('enters edit mode on double-click', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.dblClick(screen.getByText('Terminal 1'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('Terminal 1')
  })

  it('focuses and selects input on entering edit mode', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.dblClick(screen.getByText('Terminal 1'))
    const input = screen.getByRole('textbox')
    expect(input).toHaveFocus()
  })

  it('commits rename on Enter', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.dblClick(screen.getByText('Terminal 1'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New Name{Enter}')

    expect(mockRename).toHaveBeenCalledWith('test-id-1', 'New Name')
  })

  it('cancels edit on Escape without renaming', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.dblClick(screen.getByText('Terminal 1'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Changed{Escape}')

    expect(mockRename).not.toHaveBeenCalled()
    expect(screen.getByText('Terminal 1')).toBeInTheDocument()
  })

  it('commits rename on blur', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <TerminalListItem terminal={makeTerminal()} isActive={false} />
        <button>other</button>
      </div>
    )

    await user.dblClick(screen.getByText('Terminal 1'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Blur Name')
    await user.click(screen.getByText('other'))

    expect(mockRename).toHaveBeenCalledWith('test-id-1', 'Blur Name')
  })

  it('does NOT call renameTerminal if value unchanged', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.dblClick(screen.getByText('Terminal 1'))
    await user.keyboard('{Enter}')

    expect(mockRename).not.toHaveBeenCalled()
  })

  it('does NOT call renameTerminal if value is empty/whitespace', async () => {
    const user = userEvent.setup()
    render(<TerminalListItem terminal={makeTerminal()} isActive={false} />)

    await user.dblClick(screen.getByText('Terminal 1'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '   {Enter}')

    expect(mockRename).not.toHaveBeenCalled()
  })

  it('applies .active class when isActive is true', () => {
    const { container } = render(
      <TerminalListItem terminal={makeTerminal()} isActive={true} />
    )
    expect(container.firstChild).toHaveClass('active')
  })

  it('applies .dead class when terminal is not alive', () => {
    const { container } = render(
      <TerminalListItem
        terminal={makeTerminal({ isAlive: false })}
        isActive={false}
      />
    )
    expect(container.firstChild).toHaveClass('dead')
  })

  it('does not apply .active or .dead when neither condition is true', () => {
    const { container } = render(
      <TerminalListItem terminal={makeTerminal()} isActive={false} />
    )
    expect(container.firstChild).not.toHaveClass('active')
    expect(container.firstChild).not.toHaveClass('dead')
  })
})
