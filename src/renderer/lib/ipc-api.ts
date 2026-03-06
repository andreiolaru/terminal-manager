export const ipcApi = window.electronAPI

export function destroyPtySafe(id: string): void {
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.destroyPty(id).catch(() => {})
  }
}

export function onShortcutSafe(name: string, callback: () => void): () => void {
  if (typeof window !== 'undefined' && window.electronAPI?.onShortcut) {
    return window.electronAPI.onShortcut(name, callback)
  }
  return () => {}
}

export function setWindowTitleSafe(title: string): void {
  if (typeof window !== 'undefined' && window.electronAPI?.setWindowTitle) {
    window.electronAPI.setWindowTitle(title)
  }
}

export async function listTemplatesSafe(): Promise<import('../../shared/template-types').LayoutTemplate[]> {
  if (typeof window !== 'undefined' && window.electronAPI?.listTemplates) {
    return window.electronAPI.listTemplates()
  }
  return []
}

export async function saveTemplatesSafe(templates: import('../../shared/template-types').LayoutTemplate[]): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.saveTemplates) {
    await window.electronAPI.saveTemplates(templates)
  }
}
