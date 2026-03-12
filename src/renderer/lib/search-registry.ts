import type { SearchAddon } from '@xterm/addon-search'

// Shared registry so SearchBar can access the SearchAddon for a given terminal.
// Populated by TerminalInstance on addon load, consumed by SearchBar.
export const searchAddonRegistry = new Map<string, SearchAddon>()
