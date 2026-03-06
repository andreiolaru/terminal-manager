// PTY IPC dispatching is now handled centrally by src/renderer/lib/pty-dispatcher.ts
// This module is kept for backward compatibility but is a no-op.
// The dispatcher registers a single onPtyData/onPtyExit listener and routes
// data to terminals via O(1) Map lookup instead of O(N) fan-out.
export function usePtyIpc(): void {
  // no-op — exit handling moved to pty-dispatcher
}
