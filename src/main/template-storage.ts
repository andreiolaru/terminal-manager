import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { LayoutTemplate, LayoutNode } from '../shared/template-types'

function isValidLayoutNode(node: unknown): node is LayoutNode {
  if (typeof node !== 'object' || node === null) return false
  const n = node as Record<string, unknown>
  if (n.type === 'leaf') {
    return typeof n.terminal === 'object' && n.terminal !== null
      && typeof (n.terminal as Record<string, unknown>).title === 'string'
  }
  if (n.type === 'branch') {
    return (n.direction === 'horizontal' || n.direction === 'vertical')
      && typeof n.ratio === 'number'
      && isValidLayoutNode(n.first)
      && isValidLayoutNode(n.second)
  }
  return false
}

function isValidTemplate(item: unknown): item is LayoutTemplate {
  if (typeof item !== 'object' || item === null) return false
  const t = item as Record<string, unknown>
  return typeof t.id === 'string'
    && typeof t.name === 'string'
    && isValidLayoutNode(t.layout)
}

export class TemplateStorage {
  private filePath: string

  constructor() {
    const dir = join(app.getPath('appData'), 'terminal-manager')
    this.filePath = join(dir, 'templates.json')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  list(): LayoutTemplate[] {
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isValidTemplate)
    } catch {
      return []
    }
  }

  save(templates: unknown): void {
    if (!Array.isArray(templates)) return
    const valid = templates.filter(isValidTemplate)
    writeFileSync(this.filePath, JSON.stringify(valid, null, 2), 'utf-8')
  }

  getPath(): string {
    return this.filePath
  }
}
