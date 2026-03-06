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
