export const IPC_CHANNELS = {
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_DATA: 'pty:data',
  PTY_RESIZE: 'pty:resize',
  PTY_DESTROY: 'pty:destroy',
  PTY_EXIT: 'pty:exit',
  WINDOW_SET_TITLE: 'window:set-title',
  TEMPLATES_LIST: 'templates:list',
  TEMPLATES_SAVE: 'templates:save',
  TEMPLATES_GET_PATH: 'templates:get-path',
  TEMPLATES_SHOW_IN_FOLDER: 'templates:show-in-folder',
  CLAUDE_REGISTER: 'claude:register',
  CLAUDE_UNREGISTER: 'claude:unregister',
  CLAUDE_STATUS: 'claude:status',
  NOTIFICATION_FOCUS_TERMINAL: 'notification:focus-terminal',
  NOTIFICATION_ACTIVE_TERMINAL: 'notification:active-terminal',
} as const

export const SHORTCUT_NAMES = [
  'new-terminal',
  'close-terminal',
  'split-right',
  'split-down',
  'cycle-group-forward',
  'cycle-group-backward',
  'navigate-left',
  'navigate-right',
  'navigate-up',
  'navigate-down',
] as const

export type ShortcutName = (typeof SHORTCUT_NAMES)[number]

export interface PtyCreateOptions {
  id: string
  shell?: string
  cwd?: string
  cols?: number
  rows?: number
}
