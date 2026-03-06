---
description: Activate JavaScript expertise for async patterns, performance optimization, and Node.js specifics
---

You are now operating with deep JavaScript expertise, specifically tuned to this terminal-manager project.

## Performance-Critical Patterns in This Project

### IPC Data Flow (highest throughput path)
- PTY output → `webContents.send('pty:data')` → single global listener → `Map.get(id)` → `terminal.write(data)`
- This is O(1) routing via the centralized dispatcher (`src/renderer/lib/pty-dispatcher.ts`)
- Never add per-instance listeners — that creates O(N) fan-out per keystroke

### Resize Debouncing
```
ResizeObserver fires → clearTimeout(prev) → setTimeout(75ms) → cancelAnimationFrame(prev) → requestAnimationFrame → fitAddon.fit() → ipcApi.resizePty()
```
- Both timeout and rAF IDs tracked and cancelled on cleanup
- Skip when terminal is hidden (`visibleRef.current` check) — `display:none` gives 0×0 dimensions

### Memory Management
- xterm instances stored in `useRef` — never recreated on re-render
- PTY processes cleaned up in two layers: store actions + component unmount (belt and suspenders)
- `PtyManager.destroy()` removes from Map BEFORE kill to suppress onExit handler
- `destroyAll()` clears map first, then kills all — prevents event handler race

### Module-Level Singletons
- `pty-dispatcher.ts` uses module-level `Map<string, Terminal>` — singleton pattern
- Listeners registered lazily on first `registerTerminal` call
- Cleaned up when last terminal unregisters (Map size === 0)
- `_resetForTesting()` exported for test isolation

## Async Patterns

- `ipcApi.createPty()` — Promise-based, `.catch()` shows error in terminal
- `ipcApi.destroyPty()` — Promise-based, `.catch(() => {})` silences (PTY may already be dead)
- `destroyPtySafe()` — null-guards `window.electronAPI` for test environment compatibility
- Store actions call `destroyPtySafe` outside `set()` callback (side effects after state mutation)

## Event Handling

- `terminal.onData()` → `ipcApi.writePty()` (fire-and-forget, no awaiting)
- `ResizeObserver` with debounce — disconnect in cleanup
- `requestAnimationFrame` — cancel stale frames in cleanup
- Preload `onPtyData`/`onPtyExit` return unsubscribe functions — always call in cleanup

## Node.js Specifics (Main Process)

- node-pty spawns real OS processes — always validate shell name and cwd
- `process.env` filtered to remove `undefined` values before passing to pty.spawn
- Cols/rows validated: `Number.isFinite(x) && x > 0 ? Math.floor(x) : default`
- App cleanup: `before-quit` calls `ptyManager.destroyAll()`

When optimizing or debugging, focus on the IPC data path and resize handling — these are the hot paths.
