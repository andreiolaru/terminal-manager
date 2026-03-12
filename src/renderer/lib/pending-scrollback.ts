// Holds scrollback data from a restored session until the TerminalInstance mounts and replays it.
// Stored outside Zustand to avoid triggering auto-save when consumed.
export const pendingScrollback = new Map<string, string>()
