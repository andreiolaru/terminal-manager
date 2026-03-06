import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import type { SplitNode } from '../../store/types'
import TerminalPane from '../Terminal/TerminalPane'

interface SplitContainerProps {
  node: SplitNode
  groupId: string
}

export default function SplitContainer({ node, groupId }: SplitContainerProps) {
  if (node.type === 'leaf') {
    return <TerminalPane terminalId={node.terminalId} groupId={groupId} />
  }

  return (
    <Allotment vertical={node.direction === 'vertical'}>
      <Allotment.Pane>
        <SplitContainer node={node.first} groupId={groupId} />
      </Allotment.Pane>
      <Allotment.Pane>
        <SplitContainer node={node.second} groupId={groupId} />
      </Allotment.Pane>
    </Allotment>
  )
}
