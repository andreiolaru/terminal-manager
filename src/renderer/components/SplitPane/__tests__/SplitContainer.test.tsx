import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('allotment/dist/style.css', () => ({}))
vi.mock('../../Terminal/TerminalPane', () => ({
  default: ({ terminalId }: { terminalId: string }) => {
    if (terminalId === 'crash') throw new Error('Intentional test error')
    return null
  }
}))

import SplitContainerWithBoundary from '../SplitContainer'

describe('SplitErrorBoundary (M12)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders fallback UI when a child component throws', () => {
    render(
      <SplitContainerWithBoundary
        node={{ type: 'leaf', terminalId: 'crash' }}
        groupId="g1"
      />
    )

    expect(screen.getByText(/Terminal pane error/)).toBeInTheDocument()
  })

  it('includes recovery instructions in fallback', () => {
    render(
      <SplitContainerWithBoundary
        node={{ type: 'leaf', terminalId: 'crash' }}
        groupId="g1"
      />
    )

    expect(screen.getByText(/Close this group/)).toBeInTheDocument()
  })

  it('renders children normally when no error occurs', () => {
    render(
      <SplitContainerWithBoundary
        node={{ type: 'leaf', terminalId: 'ok' }}
        groupId="g1"
      />
    )

    expect(screen.queryByText(/Terminal pane error/)).not.toBeInTheDocument()
  })
})
