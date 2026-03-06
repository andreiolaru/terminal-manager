---
paths:
  - "src/renderer/lib/**"
  - "src/renderer/hooks/**"
  - "src/renderer/store/**"
---

# JavaScript Performance Rules

## IPC Data Flow (highest throughput path)

- PTY output > `webContents.send('pty:data')` > single global listener > `Map.get(id)` > `terminal.write(data)`
- O(1) routing via centralized dispatcher (`src/renderer/lib/pty-dispatcher.ts`)
- Never add per-instance listeners — creates O(N) fan-out per keystroke

## Resize Debouncing

`ResizeObserver > clearTimeout(prev) > setTimeout(75ms) > cancelAnimationFrame(prev) > requestAnimationFrame > fitAddon.fit() > ipcApi.resizePty()`

- Both timeout and rAF IDs tracked and cancelled on cleanup
- Skip when terminal is hidden (`visibleRef.current` check) — `display:none` gives 0x0 dimensions

## Memory Management

- xterm instances in `useRef` — never recreated on re-render
- PTY cleanup in two layers: store actions + component unmount (belt and suspenders)
- `PtyManager.destroy()` removes from Map BEFORE kill to suppress onExit handler
- `destroyAll()` clears map first, then kills all — prevents event handler race

## Module-Level Singletons

- `pty-dispatcher.ts` uses module-level `Map<string, Terminal>` — singleton pattern
- Listeners registered lazily on first `registerTerminal` call
- Cleaned up when last terminal unregisters (Map size === 0)

## Async Patterns

- `destroyPtySafe()` — null-guards `window.electronAPI` for test environment compatibility
- Store actions call `destroyPtySafe` outside `set()` callback (side effects after state mutation)
- `ipcApi.destroyPty()` — `.catch(() => {})` silences (PTY may already be dead)

## Event Handling

- `terminal.onData()` > `ipcApi.writePty()` (fire-and-forget, no awaiting)
- `ResizeObserver` with debounce — disconnect in cleanup
- `requestAnimationFrame` — cancel stale frames in cleanup
- Preload `onPtyData`/`onPtyExit` return unsubscribe functions — always call in cleanup
