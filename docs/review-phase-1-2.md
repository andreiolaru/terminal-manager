# Multi-Subagent Code Review: Consolidated Findings

## Context

Four specialized subagents (electron-pro, react-specialist, ui-designer, javascript-pro) — plus the earlier typescript-pro review — performed independent reviews of all 19 source files, 3 CSS files, and config files. This plan consolidates and deduplicates their findings into a single prioritized action list.

---

## Critical Issues (11 unique, deduplicated across all 5 reviews)

### Security (Electron)
| # | Issue | File(s) | Lines |
|---|-------|---------|-------|
| C1 | **No Content Security Policy** — XSS via terminal escape sequences can load remote scripts | `src/main/index.ts` | — |
| C2 | **No IPC input validation on shell path** — renderer can execute any binary via `pty:create` | `src/main/ipc-handlers.ts` | 5-14 |
| C3 | **No navigation/window-open restrictions** — malicious link could navigate app window | `src/main/index.ts` | — |
| C4 | **`sandbox: false` unnecessary** — preload only uses contextBridge/ipcRenderer | `src/main/index.ts` | 16 |

### Runtime / Resource Management
| # | Issue | File(s) | Lines |
|---|-------|---------|-------|
| C5 | **Race condition: PTY emits data before listener registered** — `createPty` called BEFORE `onPtyData` subscription; initial shell prompt can be lost | `TerminalInstance.tsx` | 49-59 |
| C6 | **Double-kill lifecycle** — `destroy()` kills PTY, but `onExit` still fires, sends IPC to potentially destroyed window | `pty-manager.ts` | 25-28, 41-47 |
| C7 | **Unhandled `createPty` promise rejection** — if `pty.spawn()` throws, no feedback to user, unhandled rejection | `TerminalInstance.tsx` + `ipc-handlers.ts` | 49, 5-14 |
| C8 | **`destroyPty` in cleanup has no `.catch()`** — can reject if PTY already dead | `TerminalInstance.tsx` | 89 |

### Performance / Scalability
| # | Issue | File(s) | Lines |
|---|-------|---------|-------|
| C9 | **O(N) broadcast fan-out on `pty:data`** — each terminal registers a global listener, filters by ID. N terminals = N callbacks per data chunk | `TerminalInstance.tsx` | 55-58 |
| C10 | **Resize not debounced** — `RESIZE_DEBOUNCE_MS = 75` defined but never used; ResizeObserver floods PTY at 60fps during drag | `TerminalInstance.tsx` + `constants.ts` | 71-80, 3 |

### Accessibility (UI)
| # | Issue | File(s) | Lines |
|---|-------|---------|-------|
| C11 | **No focus indicators on any interactive element** — WCAG 2.4.7 failure; sidebar items not keyboard navigable (div with onClick, no tabIndex/role) | `sidebar.css`, `TerminalListItem.tsx` | 95, 61 |

---

## Moderate Issues (18 unique)

### Architecture
- **M1.** No shared IPC channel type constants — channel names hardcoded as strings across 3 process boundaries (`ipc-handlers.ts`, `pty-manager.ts`, `preload/index.ts`)
- **M2.** Terminal IDs generated in renderer, trusted blindly by main — should be generated in main process
- **M3.** `TerminalId` is a bare `string` alias, no branded type (`types.ts:1`)
- **M4.** Duplicate `onPtyExit` listener — exit handling split between `TerminalInstance.tsx` and `usePtyIpc.ts`
- **M5.** PtyManager only supports single window (`pty-manager.ts:6-10`)

### React / State
- **M6.** `TerminalPanel` subscribes to entire `terminals` record — any mutation re-renders all terminals; should use `useShallow(Object.keys)` (`TerminalPanel.tsx:5`)
- **M7.** `TerminalList` also over-broad selector + unsorted `Object.values().sort()` on every render
- **M8.** `TerminalListItem` not wrapped in `React.memo` — re-renders on every parent re-render
- **M9.** No `<React.StrictMode>` wrapper (`main.tsx:5`)
- **M10.** No error boundaries anywhere — render error crashes entire app

### Resource Management
- **M11.** No `before-quit` PTY cleanup — force-quit/crash leaves orphaned PTYs (`index.ts:40-43`)
- **M12.** `destroyAll` doesn't suppress `onExit` handlers — shutdown fires spurious events
- **M13.** No backpressure on `pty:data` — large output floods IPC/renderer (`pty-manager.ts:22`)

### Configuration
- **M14.** Missing `target`/`lib` in both tsconfig files — defaults to ES3/ES5, inappropriate for Electron 35
- **M15.** Missing `postinstall` script in `package.json` (only manual `rebuild`)
- **M16.** No single-instance lock (`app.requestSingleInstanceLock`)
- **M17.** No `session.setPermissionRequestHandler` — defaults to granting all permissions
- **M18.** Unsafe `process.env as Record<string, string>` cast (`pty-manager.ts:18`)

---

## Minor Suggestions (16 unique)

- **S1.** No CSS custom properties — colors hardcoded; blocks Phase 6 theming
- **S2.** Color contrast failures (`.terminal-panel-empty` #666 on #1e1e1e = ~3.1:1, fails WCAG AA)
- **S3.** No scrollbar styling for sidebar (Windows light scrollbar on dark theme)
- **S4.** No transitions on hover/state changes (VS Code uses ~100ms)
- **S5.** Close button only visible on hover — invisible to keyboard/touch
- **S6.** Missing `aria-label` on "+" and "x" buttons
- **S7.** Terminal title numbering can duplicate after deletions; use monotonic counter
- **S8.** `ipc-api.ts` re-exports `window.electronAPI` with no null guard
- **S9.** `main.tsx` non-null assertion on `getElementById('root')!`
- **S10.** `addTerminal` implementation returns `string` instead of `TerminalId` type
- **S11.** WebglAddon failure silently swallowed (empty `catch {}`)
- **S12.** DevTools not restricted in production builds
- **S13.** `process.env` passed wholesale to PTY — leaks all env vars
- **S14.** xterm CSS imported in component instead of entry point
- **S15.** Missing `contain: strict` on terminal containers for GPU perf
- **S16.** No `nativeTheme` integration for system dark/light mode detection

---

## Positive Patterns (across all reviews)

- Correct `contextIsolation: true` + `nodeIntegration: false` security boundary
- Clean minimal `contextBridge` API with proper unsubscribe functions
- Correct IPC pattern selection (invoke for req/resp, send for fire-and-forget)
- `display: none` for hidden terminals (preserves scrollback)
- xterm instances in `useRef` (no re-creation on re-render)
- Thorough cleanup in `useEffect` return (correct ordering)
- `requestAnimationFrame` before `fitAddon.fit()`
- Correct Zustand 5 + immer double-invocation pattern
- Clean discriminated union type for `SplitNode` (ready for Phase 3)
- Granular Zustand selectors in most components
- Proper `didInit` ref guard for StrictMode compatibility
- Correct `asarUnpack` and `externalizeDepsPlugin` configuration

---

## Recommended Fix Order

### Tier 1 — Before any further development
1. Add CSP (C1)
2. Validate shell path in IPC handler (C2)
3. Add navigation/window-open restrictions (C3)
4. Re-enable sandbox (C4)
5. Register `onPtyData` listener BEFORE `createPty` call (C5)
6. Fix double-kill lifecycle in PtyManager (C6)
7. Handle `createPty` promise rejection (C7)
8. Add `.catch()` to `destroyPty` in cleanup (C8)
9. Add focus indicators + keyboard navigation (C11)

### Tier 2 — Before Phase 3 (split panes)
10. Implement data dispatch registry for O(1) routing (C9)
11. Wire up resize debounce with existing constant (C10)
12. Add shared IPC channel constants (M1)
13. Narrow store selectors with `useShallow` (M6, M7)
14. Add `React.memo` to `TerminalListItem` (M8)
15. Add error boundaries (M10)
16. Add `before-quit` cleanup (M11)

### Tier 3 — Phase 5 polish
17. Extract CSS custom properties (S1)
18. Fix color contrast (S2)
19. Style sidebar scrollbar (S3)
20. Add transitions (S4)
21. Add `React.StrictMode` (M9)
22. Remaining minor suggestions

---

## Verification

After implementing fixes:
1. `npm run dev` — app launches without console errors
2. Open DevTools → verify CSP header in Network tab
3. Create 5+ terminals — verify no prompt loss (C5 fix)
4. Close terminals — verify no orphaned PTY processes in Task Manager
5. Tab through sidebar — verify focus indicators visible (C11 fix)
6. Resize window rapidly — verify no PTY flooding (C10 fix)
7. Kill shell process externally — verify graceful handling (C6, C7 fixes)
