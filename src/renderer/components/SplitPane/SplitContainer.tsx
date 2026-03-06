import { memo, Component, type ReactNode, type ErrorInfo } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import type { SplitNode } from '../../store/types'
import TerminalPane from '../Terminal/TerminalPane'

const MIN_PANE_SIZE = 50

interface SplitContainerProps {
  node: SplitNode
  groupId: string
}

const SplitContainer = memo(function SplitContainer({ node, groupId }: SplitContainerProps) {
  if (node.type === 'leaf') {
    return <TerminalPane terminalId={node.terminalId} groupId={groupId} />
  }

  const firstSize = Math.round(node.ratio * 1000)
  const secondSize = 1000 - firstSize

  return (
    <Allotment vertical={node.direction === 'vertical'} defaultSizes={[firstSize, secondSize]}>
      <Allotment.Pane minSize={MIN_PANE_SIZE}>
        <SplitContainer node={node.first} groupId={groupId} />
      </Allotment.Pane>
      <Allotment.Pane minSize={MIN_PANE_SIZE}>
        <SplitContainer node={node.second} groupId={groupId} />
      </Allotment.Pane>
    </Allotment>
  )
})

interface ErrorBoundaryProps {
  children: ReactNode
  groupId: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

class SplitErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`SplitContainer error in group ${this.props.groupId}:`, error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#cc6666', padding: 16, textAlign: 'center' }}>
          Terminal pane error. Close this group and try again.
        </div>
      )
    }
    return this.props.children
  }
}

export default function SplitContainerWithBoundary({ node, groupId }: SplitContainerProps) {
  return (
    <SplitErrorBoundary groupId={groupId}>
      <SplitContainer node={node} groupId={groupId} />
    </SplitErrorBoundary>
  )
}
