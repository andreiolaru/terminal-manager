# Full Codebase Review

**Date:** 2026-03-06
**Scope:** All phases (1-6) -- Electron, React, TypeScript, UI/CSS, JavaScript performance
**Method:** 5 parallel domain-specialist review agents

## Executive Summary

The codebase is well-architected with strong fundamentals: correct Electron security model (`contextIsolation`, no `nodeIntegration`), centralized IPC dispatch with O(1) routing, proper PTY lifecycle management, and disciplined use of TypeScript strict mode with zero `any` in production code. The main areas for improvement are **React rendering efficiency** (broad Zustand selectors causing unnecessary re-renders) and **accessibility gaps** (missing ARIA attributes, focus traps, keyboard navigation).

---

## Critical -- React Rendering Cascades

These 4 issues share a root cause: Zustand selectors return entire `groups`/`terminals` objects, which immer replaces on every mutation, triggering unnecessary re-renders across the component tree.

| ID | File | Issue |
|----|------|-------|
| **C1** | `TerminalPanel.tsx:7` | `useTerminalStore((s) => s.groups)` -- every store mutation re-renders all group containers |
| **C2** | `TerminalTabs.tsx:9` | Same broad `s.groups` selector -- tab bar re-renders on every mutation |
| **C3** | `TerminalList.tsx:6-8` | Subscribes to both `s.terminals` and `s.groups` -- runs tree traversal + sort on every change |
| **C4** | `TerminalInstance.tsx:19` | Not wrapped in `React.memo` -- re-renders propagate from parent through to xterm container |

**Fix pattern:** Use `useShallow` from `zustand/react/shallow` to select only IDs, then have each child component select its own data. Add `memo()` to `TerminalInstance` and `TerminalListItem`.

```tsx
// Example for C1 -- TerminalPanel
import { useShallow } from 'zustand/react/shallow'
const groupIds = useTerminalStore(useShallow((s) => s.groups.map(g => g.id)))
// Render groupIds.map(id => <GroupContainer key={id} groupId={id} />)
// where GroupContainer selects its own splitTree via useTerminalStore
```

---

## High Severity

### Electron / IPC

| ID | File | Issue |
|----|------|-------|
| **E1** | `pty-manager.ts:27,36` | Hardcoded `'pty:data'`/`'pty:exit'` strings instead of `IPC_CHANNELS` constants -- silent breakage if renamed |
| **E2** | `ipc-handlers.ts:27-74` | IPC sender not validated -- any webContents can invoke PTY handlers |
| **E3** | `package.json` | Missing `postinstall` script -- `CLAUDE.md` documents it but it doesn't exist; fresh install won't rebuild node-pty |
| **E4** | `ipc-handlers.ts:27,48,52,58` | No runtime type validation on IPC parameters (TypeScript types erased at runtime) |
| **E5** | `ipc-handlers.ts:38-39,53-54` | No upper bound on cols/rows -- extreme values could cause ConPTY memory exhaustion |

#### E1 Fix

```typescript
// pty-manager.ts -- import shared constants
import { IPC_CHANNELS } from '../shared/ipc-types'
// Replace:
this.window?.webContents.send('pty:data', id, data)
this.window?.webContents.send('pty:exit', id, exitCode)
// With:
this.window?.webContents.send(IPC_CHANNELS.PTY_DATA, id, data)
this.window?.webContents.send(IPC_CHANNELS.PTY_EXIT, id, exitCode)
```

#### E2 Fix

```typescript
// In each handler:
ipcMain.handle(IPC_CHANNELS.PTY_CREATE, async (event, options) => {
  if (event.sender !== ptyManager.getWindow()?.webContents) return
  // ...
})
```

#### E4-E5 Fix

```typescript
// Type guards + upper bounds
ipcMain.on(IPC_CHANNELS.PTY_WRITE, (_, id: string, data: string) => {
  if (typeof id !== 'string' || typeof data !== 'string') return
  ptyManager.write(id, data)
})

const cols = Number.isFinite(rawCols) && rawCols > 0 && rawCols <= 500 ? Math.floor(rawCols) : 80
const rows = Number.isFinite(rawRows) && rawRows > 0 && rawRows <= 200 ? Math.floor(rawRows) : 24
```

### React / State

| ID | File | Issue |
|----|------|-------|
| **R1** | `TerminalListItem.tsx:10` | Missing `React.memo` -- re-renders on every store change via parent |
| **R2** | `TerminalTabs.tsx:58-92` | Inline closures in `.map()` recreated every render -- extract memoized `TabItem` component |
| **R3** | `useShortcuts.ts:52` | Bare `.subscribe()` fires `updateTitle` IPC on every store mutation, not just title changes |
| **R4** | `terminal-store.ts:191` + `TerminalInstance.tsx:125` | Double `pty:destroy` IPC -- store and component cleanup both fire |

#### R1 Fix

```tsx
export default memo(function TerminalListItem({ terminal, isActive }: TerminalListItemProps) {
  // ...
}, (prev, next) =>
  prev.terminal.id === next.terminal.id &&
  prev.terminal.title === next.terminal.title &&
  prev.terminal.isAlive === next.terminal.isAlive &&
  prev.isActive === next.isActive
)
```

#### R3 Fix

```typescript
// Replace bare subscribe with selector-based subscription
const unsub = useTerminalStore.subscribe(
  (s) => {
    const group = s.groups.find((g) => g.id === s.activeGroupId)
    return group ? s.terminals[group.activeTerminalId]?.title : null
  },
  (title) => {
    setWindowTitleSafe(title ? `${title} - Terminal Manager` : 'Terminal Manager')
  }
)
```

#### R4 Fix

Choose one authoritative cleanup path. The store is preferred since it handles non-React-driven removal. Remove `ipcApi.destroyPty(terminalId)` from `TerminalInstance` cleanup, keep it in store actions only.

### TypeScript

| ID | File | Issue |
|----|------|-------|
| **T1** | `SplitContainer.tsx:14-29` | Only tree consumer missing `assertNever` exhaustive check on `SplitNode` |
| **T2** | `preload/index.d.ts:11`, `ipc-api.ts:9` | `onShortcut` parameter typed as `string` instead of `ShortcutName` |
| **T3** | `tsconfig.web.json`, `tsconfig.node.json` | `noUncheckedIndexedAccess` not enabled -- `arr[n]` treated as `T` not `T | undefined` |

### Accessibility

| ID | File | Issue |
|----|------|-------|
| **A1** | `TerminalTabs.tsx:59-91` | Tab bar has `role="tablist"` but no arrow key navigation -- inactive tabs unreachable by keyboard |
| **A2** | `TemplateManager.tsx:87-166` | Modal missing focus trap, Escape handler, and focus restoration |
| **A3** | `TemplateManager.tsx:88-89` | Modal missing `role="dialog"` and `aria-modal="true"` |
| **A4** | `SidebarActions.tsx:9-13` | Icon buttons (`+`, `\u229e`) have no `aria-label` |
| **A5** | `template-manager.css` (all) | Zero `:focus-visible` styles -- keyboard users see no focus indicators |
| **A6** | `TemplateLauncher.tsx:58-89` | Dropdown menu has no keyboard navigation or focus management |
| **A7** | `tabs.css:76,82-85` | Tab close button at `opacity: 0` not revealed on `:focus-within` -- invisible to keyboard |

---

## Medium Severity

| ID | Domain | File | Issue |
|----|--------|------|-------|
| **M1** | Electron | `index.ts:32` | `sandbox: false` weakens renderer isolation (electron-vite limitation) |
| **M2** | React | `TerminalInstance.tsx:62` | Initial `fitAddon.fit()` called without `requestAnimationFrame` |
| **M3** | React | `SplitContainer.tsx:40-61` | Error boundary has no recovery/retry mechanism |
| **M4** | React | `TemplateLauncher.tsx:18-29` | Async IPC call inside `setState` updater (should be pure) |
| **M5** | React | `TemplateManager.tsx:27-36` | `isSaving` in `useCallback` deps -- stale closure race + unstable identity |
| **M6** | React | `TerminalInstance.tsx:130-139` | Visibility-refit `requestAnimationFrame` not cancelled on cleanup |
| **M7** | React | `TemplateManager.tsx:23-25` | Template load has no error handling or unmount cancellation |
| **M8** | TS | `tsconfig.node.json` | No `lib` specified -- main process gets DOM types, allowing `document.*` |
| **M9** | TS | `ipc-types.ts` | Shortcut channels (`shortcut:${name}`) not centralized like PTY channels |
| **M10** | TS | `ipcRenderer.invoke` return types trusted without runtime validation | Preload asserts return types that Electron cannot enforce |
| **M11** | CSS | `sidebar.css:25`, `terminal.css:49,51`, `SplitContainer.tsx:54` | 4 hardcoded colors outside the custom property system |
| **M12** | CSS | `sidebar.css:85-88` | Dead terminals use `line-through` in sidebar but `italic` in pane title -- inconsistent |
| **M13** | CSS | `TemplateManager.tsx:159` | Disabled button has no visual distinction (no CSS for `:disabled`) |
| **M14** | CSS | `TemplateManager.tsx:126` | Inline style override should be a CSS modifier class |
| **M15** | A11y | `TemplateManager.tsx:100-124` | `<label>` elements not associated with inputs (`htmlFor` missing) |
| **M16** | A11y | `terminal.css:49` | `kbd` border `#555` on `#3c3c3c` fails WCAG 3:1 for UI components |

---

## Low Severity

| ID | Domain | Issue |
|----|--------|-------|
| **L1** | Perf | `tree-utils.ts:63` -- `collectLeafIds` spreads arrays at each recursion level (O(N*D) vs O(N)) |
| **L2** | Perf | `terminal-store.ts:12-14` -- `findGroupForTerminal` is O(G*T), could use an index |
| **L3** | Perf | `TerminalPane.tsx:14-16` -- `isActive` selector runs `groups.find()` on every store change |
| **L4** | TS | Inline `import()` type in `store/types.ts:68` -- should be top-level import |
| **L5** | TS | `color-utils.ts:24` -- `gradient.angle!` assertion, should use `??` instead |
| **L6** | TS | `TemplateLauncher.tsx:34` -- `e.target as Node` cast, should use `instanceof` guard |
| **L7** | TS | `ipc-api.ts:1` -- module-level `window.electronAPI` snapshot, evaluation-order dependent |
| **L8** | CSS | `tabs.css` -- duplicate `:focus-visible` rule blocks (3 instances) |
| **L9** | CSS | `splitpane.css:67-76` -- redundant `outline: none` immediately overridden |
| **L10** | CSS | No transitions on hover/focus states except one title bar border |
| **L11** | CSS | `#ffffff` hardcoded in multiple files -- could be `--tm-text-on-accent` |

---

## Positive Highlights

The following areas were reviewed and found correctly implemented:

**Security Model**
- `contextIsolation: true`, `nodeIntegration: false` explicitly set
- CSP headers in production, navigation blocked, permissions denied
- No `@electron/remote`, no `eval()`, no `shell.openExternal()`
- Preload uses contextBridge, never exposes raw `ipcRenderer`
- Shortcut names whitelisted in preload via `Set`

**IPC Architecture**
- `pty:create`/`pty:destroy` use invoke/handle (awaitable) -- correct
- `pty:write`/`pty:resize` use send/on (fire-and-forget) -- correct
- `pty:data`/`pty:exit` use webContents.send (push) -- correct
- Centralized dispatcher with `Map<id, Terminal>` for O(1) routing

**PTY Lifecycle**
- Delete-before-kill ordering prevents stale exit events
- Split-race guard: `get(id) !== ptyProcess` check in onExit
- `destroyAll()` on `before-quit` as safety net
- Store calls `destroyPtySafe` outside immer producer (side-effect discipline)

**TypeScript Discipline**
- Zero `any` in production code
- Zero `@ts-ignore` or `@ts-expect-error`
- `import type` used consistently across all files
- `IPC_CHANNELS` and `SHORTCUT_NAMES` use `as const` for literal types
- `PtyCreateOptions` shared across all three processes
- 8 of 9 tree-walking functions use `assertNever` exhaustive checks
- `TemplateStorage.save()` accepts `unknown` with recursive type guards

**React Patterns**
- xterm instances in `useRef`, never recreated on re-render
- Hidden terminals use `display: none`, not unmount (preserves scrollback)
- Resize debounced with `setTimeout` + `requestAnimationFrame`, both cancelled on cleanup
- `ResizeObserver` skips hidden terminals via `visibleRef` guard
- `SplitContainer` and `TerminalPane` wrapped in `React.memo`
- Tree utils use structural sharing (`splitNode`/`removeNode` return same ref when unchanged)

**CSS / Theming**
- Comprehensive CSS custom property system with `applyTheme()` mirror
- Full height/width chain from `html` through Allotment containers
- Border stability: `2px solid transparent` default, no layout shift on active
- Component-scoped CSS files with namespace prefixes (no cross-file conflicts)

---

## Recommended Fix Priority

1. **Selector narrowing** (C1-C3) + `memo` additions (C4, R1) -- biggest performance win, eliminates render cascades
2. **IPC channel constants** (E1) -- trivial fix, prevents silent breakage
3. **Accessibility fundamentals** (A1-A7) -- modal focus trap, ARIA labels, keyboard navigation
4. **Double destroy** (R4) -- choose one authoritative cleanup path
5. **Window title subscription** (R3) -- selector-based subscribe to reduce IPC noise
6. **Runtime IPC validation** (E4-E5) -- type guards + upper bounds on cols/rows
7. **TypeScript strictness** (T3) -- enable `noUncheckedIndexedAccess`
8. **CSS consistency** (M11-M13) -- off-palette colors, dead terminal styling, disabled button
