export const ipcApi = window.electronAPI

export function destroyPtySafe(id: string): void {
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.destroyPty(id).catch(() => {})
  }
}
