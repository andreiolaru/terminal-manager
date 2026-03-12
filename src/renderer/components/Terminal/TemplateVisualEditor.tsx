import { useState, useCallback } from 'react'
import type { LayoutTemplate, LayoutNode, TerminalSlot } from '../../../shared/template-types'
import LayoutPreview from './LayoutPreview'
import PaneConfigPanel from './PaneConfigPanel'
import {
  type NodePath,
  getNodeAtPath,
  replaceNodeAtPath,
  splitLeafAtPath,
  removeLeafAtPath,
  countLeaves,
  nextPaneTitle,
  updateRatioAtPath,
  pathsEqual
} from '../../lib/layout-tree-utils'

interface TemplateVisualEditorProps {
  template: LayoutTemplate
  onSave: (updated: LayoutTemplate) => void
  onCancel: () => void
}

export default function TemplateVisualEditor({ template, onSave, onCancel }: TemplateVisualEditorProps) {
  const [name, setName] = useState(template.name)
  const [icon, setIcon] = useState(template.icon || '')
  const [color, setColor] = useState(template.color || '')
  const [layout, setLayout] = useState<LayoutNode>(template.layout)
  const [selectedPath, setSelectedPath] = useState<NodePath | null>(null)

  const selectedNode = selectedPath ? getNodeAtPath(layout, selectedPath) : null
  const selectedLeaf = selectedNode?.type === 'leaf' ? selectedNode : null
  const leafCount = countLeaves(layout)

  const handleSelectPane = useCallback((path: NodePath) => {
    setSelectedPath((prev) => pathsEqual(prev, path) ? null : path)
  }, [])

  const handleSplit = (direction: 'horizontal' | 'vertical') => {
    if (!selectedPath || !selectedLeaf) return
    const title = nextPaneTitle(layout)
    const newLayout = splitLeafAtPath(layout, selectedPath, direction, title)
    setLayout(newLayout)
    // Keep selection on the original pane (now at [...path, 'first'])
    setSelectedPath([...selectedPath, 'first'])
  }

  const handleRemove = () => {
    if (!selectedPath || leafCount <= 1) return
    const newLayout = removeLeafAtPath(layout, selectedPath)
    if (newLayout) {
      setLayout(newLayout)
    }
    setSelectedPath(null)
  }

  const handleTerminalChange = useCallback((updatedTerminal: TerminalSlot) => {
    if (!selectedPath) return
    const newLeaf: LayoutNode = { type: 'leaf', terminal: updatedTerminal }
    setLayout((prev) => replaceNodeAtPath(prev, selectedPath, newLeaf))
  }, [selectedPath])

  const handleRatioChange = useCallback((path: NodePath, ratio: number) => {
    setLayout((prev) => updateRatioAtPath(prev, path, ratio))
  }, [])

  const handleSave = () => {
    onSave({
      ...template,
      name: name.trim() || template.name,
      icon: icon || undefined,
      color: color || undefined,
      layout
    })
  }

  return (
    <div className="tve-container">
      {/* Metadata row */}
      <div className="tve-metadata">
        <div className="template-editor-field" style={{ flex: 1 }}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="template-editor-field">
          <label>Icon</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="e.g. BE"
            maxLength={4}
            style={{ width: 60 }}
          />
        </div>
        <div className="template-editor-field">
          <label>Color</label>
          <input
            type="color"
            value={color || '#007acc'}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="tve-toolbar">
        <button
          onClick={() => handleSplit('horizontal')}
          disabled={!selectedLeaf}
          title="Split selected pane horizontally"
        >
          Split Right
        </button>
        <button
          onClick={() => handleSplit('vertical')}
          disabled={!selectedLeaf}
          title="Split selected pane vertically"
        >
          Split Down
        </button>
        <button
          onClick={handleRemove}
          disabled={!selectedLeaf || leafCount <= 1}
          title="Remove selected pane"
          className="danger"
        >
          Remove
        </button>
        <span className="tve-toolbar-info">
          {leafCount} pane{leafCount !== 1 ? 's' : ''}
          {selectedLeaf ? ` \u2014 "${selectedLeaf.terminal.title}" selected` : ''}
        </span>
      </div>

      {/* Layout preview */}
      <div className="tve-preview">
        <LayoutPreview
          node={layout}
          path={[]}
          selectedPath={selectedPath}
          onSelectPane={handleSelectPane}
          onRatioChange={handleRatioChange}
        />
      </div>

      {/* Pane config */}
      {selectedLeaf ? (
        <PaneConfigPanel
          terminal={selectedLeaf.terminal}
          onChange={handleTerminalChange}
        />
      ) : (
        <div className="tve-pane-config-hint">Click a pane to configure it</div>
      )}

      {/* Save / Cancel */}
      <div className="template-manager-footer" style={{ border: 'none', padding: '8px 0 0' }}>
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={handleSave}>Save</button>
      </div>
    </div>
  )
}
