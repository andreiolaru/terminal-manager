import type { SerializeAddon } from '@xterm/addon-serialize'

// Shared registry so session save logic can access the SerializeAddon for each terminal.
// Populated by TerminalInstance on addon load, consumed by App.tsx save logic.
export const serializeAddonRegistry = new Map<string, SerializeAddon>()

/** Max scrollback rows to serialize per terminal to keep session files reasonable. */
export const SERIALIZE_SCROLLBACK_ROWS = 1000
