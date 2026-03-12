import { memo, useRef, useCallback, Component, type ReactNode, type ErrorInfo } from 'react'
import { Allotment, type AllotmentHandle } from 'allotment'
import 'allotment/dist/style.css'
import type { SplitNode, SplitDirection } from '../../store/types'
import { useTerminalStore } from '../../store/terminal-store'
import TerminalPane from '../Terminal/TerminalPane'
import '../../assets/styles/snap-indicator.css'

const MIN_PANE_SIZE = 50
const SNAP_THRESHOLD = 0.03 // 3% of total size

// Count segments in the same split direction (ignoring perpendicular splits).
// A vertical sub-split inside a horizontal split counts as 1 unit, not 2.
function countSegments(node: SplitNode, direction: SplitDirection): number {
  if (node.type === 'leaf') return 1
  if (node.direction !== direction) return 1
  return countSegments(node.first, direction) + countSegments(node.second, direction)
}

interface SplitContainerProps {
  node: SplitNode
  groupId: string
}

const SplitContainer = memo(function SplitContainer({ node, groupId }: SplitContainerProps) {
  const allotmentRef = useRef<AllotmentHandle>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)

  const isBranch = node.type === 'branch'
  const direction = isBranch ? node.direction : 'horizontal'
  const total = isBranch
    ? countSegments(node.first, direction) + countSegments(node.second, direction)
    : 0
  const isVertical = isBranch && direction === 'vertical'

  const handleChange = useCallback((sizes: number[]) => {
    if (!indicatorRef.current || sizes.length < 2 || total <= 1) return
    const sum = sizes[0] + sizes[1]
    if (sum === 0) return
    const ratio = sizes[0] / sum

    for (let k = 1; k < total; k++) {
      const snapPoint = k / total
      const diff = Math.abs(ratio - snapPoint)
      // Show indicator only when close to but not already at the snap point
      if (diff > 0.002 && diff < SNAP_THRESHOLD) {
        const pos = `${snapPoint * 100}%`
        const el = indicatorRef.current
        el.style.display = 'block'
        if (isVertical) {
          el.style.top = pos
          el.style.left = '0'
          el.style.right = '0'
          el.style.bottom = ''
          el.style.width = ''
          el.style.height = '2px'
        } else {
          el.style.left = pos
          el.style.top = '0'
          el.style.bottom = '0'
          el.style.right = ''
          el.style.height = ''
          el.style.width = '2px'
        }
        return
      }
    }
    indicatorRef.current.style.display = 'none'
  }, [total, isVertical])

  const handleDragEnd = useCallback((sizes: number[]) => {
    if (indicatorRef.current) indicatorRef.current.style.display = 'none'
    if (sizes.length < 2 || total <= 1) return
    const sum = sizes[0] + sizes[1]
    if (sum === 0) return
    const ratio = sizes[0] / sum

    for (let k = 1; k < total; k++) {
      const snapPoint = k / total
      if (Math.abs(ratio - snapPoint) < SNAP_THRESHOLD) {
        const snappedFirst = Math.round(snapPoint * sum)
        allotmentRef.current?.resize([snappedFirst, sum - snappedFirst])
        return
      }
    }
  }, [total])

  if (node.type === 'leaf') {
    return <TerminalPane terminalId={node.terminalId} groupId={groupId} />
  }

  const firstSize = Math.round(node.ratio * 1000)
  const secondSize = 1000 - firstSize

  return (
    <div className="split-container-wrapper">
      <div ref={indicatorRef} className="snap-indicator" style={{ display: 'none' }} />
      <Allotment
        ref={allotmentRef}
        vertical={node.direction === 'vertical'}
        defaultSizes={[firstSize, secondSize]}
        onChange={handleChange}
        onDragEnd={handleDragEnd}
      >
        <Allotment.Pane minSize={MIN_PANE_SIZE}>
          <SplitContainer node={node.first} groupId={groupId} />
        </Allotment.Pane>
        <Allotment.Pane minSize={MIN_PANE_SIZE}>
          <SplitContainer node={node.second} groupId={groupId} />
        </Allotment.Pane>
      </Allotment>
    </div>
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
  const zoomedTerminalId = useTerminalStore(
    (s) => s.groups.find((g) => g.id === groupId)?.zoomedTerminalId
  )

  return (
    <SplitErrorBoundary groupId={groupId}>
      {zoomedTerminalId ? (
        <TerminalPane terminalId={zoomedTerminalId} groupId={groupId} />
      ) : (
        <SplitContainer node={node} groupId={groupId} />
      )}
    </SplitErrorBoundary>
  )
}
