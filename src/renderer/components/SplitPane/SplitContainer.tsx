import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import type { SplitNode } from '../../store/types'
import TerminalPane from '../Terminal/TerminalPane'

interface SplitContainerProps {
  node: SplitNode
}

export default function SplitContainer({ node }: SplitContainerProps) {
  if (node.type === 'leaf') {
    return <TerminalPane terminalId={node.terminalId} />
  }

  return (
    <Allotment vertical={node.direction === 'vertical'}>
      <Allotment.Pane>
        <SplitContainer node={node.first} />
      </Allotment.Pane>
      <Allotment.Pane>
        <SplitContainer node={node.second} />
      </Allotment.Pane>
    </Allotment>
  )
}
