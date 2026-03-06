export const IPC_CHANNELS = {
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_DATA: 'pty:data',
  PTY_RESIZE: 'pty:resize',
  PTY_DESTROY: 'pty:destroy',
  PTY_EXIT: 'pty:exit',
} as const

export interface PtyCreateOptions {
  id: string
  shell?: string
  cwd?: string
  cols?: number
  rows?: number
}
