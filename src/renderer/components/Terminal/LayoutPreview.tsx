import { useCallback, useRef } from 'react'
import type { LayoutNode } from '../../../shared/template-types'
import type { NodePath } from '../../lib/layout-tree-utils'
import { pathsEqual } from '../../lib/layout-tree-utils'

interface LayoutPreviewProps {
  node: LayoutNode
  path: NodePath
  selectedPath: NodePath | null
  onSelectPane: (path: NodePath) => void
  onRatioChange?: (path: NodePath, ratio: number) => void
}

export default function LayoutPreview({ node, path, selectedPath, onSelectPane, onRatioChange }: LayoutPreviewProps) {
  if (node.type === 'leaf') {
    const isSelected = pathsEqual(path, selectedPath)
    return (
      <div
        className={`tve-leaf${isSelected ? ' selected' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelectPane(path) }}
        title={node.terminal.title}
      >
        <span className="tve-leaf-title">{node.terminal.title}</span>
        {node.terminal.shell && (
          <span className="tve-leaf-shell">{node.terminal.shell.replace(/.*[\\/]/, '')}</span>
        )}
      </div>
    )
  }

  const isHorizontal = node.direction === 'horizontal'
  const firstFlex = node.ratio
  const secondFlex = 1 - node.ratio

  return (
    <div className={`tve-branch ${isHorizontal ? 'horizontal' : 'vertical'}`}>
      <div style={{ flex: firstFlex, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <LayoutPreview
          node={node.first}
          path={[...path, 'first']}
          selectedPath={selectedPath}
          onSelectPane={onSelectPane}
          onRatioChange={onRatioChange}
        />
      </div>
      <DragHandle
        direction={node.direction}
        path={path}
        ratio={node.ratio}
        onRatioChange={onRatioChange}
      />
      <div style={{ flex: secondFlex, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <LayoutPreview
          node={node.second}
          path={[...path, 'second']}
          selectedPath={selectedPath}
          onSelectPane={onSelectPane}
          onRatioChange={onRatioChange}
        />
      </div>
    </div>
  )
}

interface DragHandleProps {
  direction: 'horizontal' | 'vertical'
  path: NodePath
  ratio: number
  onRatioChange?: (path: NodePath, ratio: number) => void
}

function DragHandle({ direction, path, ratio, onRatioChange }: DragHandleProps) {
  const dragging = useRef(false)
  const parentRef = useRef<HTMLElement | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onRatioChange) return
    e.preventDefault()
    dragging.current = true

    const handle = e.currentTarget as HTMLElement
    const parent = handle.parentElement
    if (!parent) return
    parentRef.current = parent

    const rect = parent.getBoundingClientRect()
    const isH = direction === 'horizontal'

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const pos = isH ? ev.clientX - rect.left : ev.clientY - rect.top
      const total = isH ? rect.width : rect.height
      const newRatio = Math.max(0.1, Math.min(0.9, pos / total))
      onRatioChange(path, newRatio)
    }

    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [direction, path, ratio, onRatioChange])

  return (
    <div
      className={`tve-drag-handle ${direction === 'horizontal' ? 'h' : 'v'}`}
      onMouseDown={handleMouseDown}
    />
  )
}
