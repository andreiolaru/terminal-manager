# Plan: Codebase Review Fixes

## Context

A full 5-domain codebase review identified 40+ issues across Electron/IPC, React rendering, TypeScript, accessibility, and CSS. The highest-impact problems are **Zustand selector cascades** causing every store mutation to re-render the entire component tree, and **accessibility gaps** in the template manager modal and tab keyboard navigation. Fixes are grouped into 6 independently committable batches ordered by impact.

---

## Batch 1: Zustand Selector Optimization + React.memo

**Why:** Every store mutation (including high-frequency terminal title renames from PTY output) re-renders TerminalPanel, TerminalTabs, and TerminalList because selectors return full `groups`/`terminals` objects that immer replaces on every mutation.

### 1A. `src/renderer/components/Terminal/TerminalPanel.tsx`

Extract a memoized `GroupPane` component. TerminalPanel selects only group IDs with `useShallow`.

- Import `memo` from react, `useShallow` from `zustand/react/shallow`
- Create `GroupPane = memo(...)` that takes `groupId: string`, selects its own group data from store, renders the `terminal-group-container` div + `SplitContainer`
- Change TerminalPanel to select `groupIds` via `useShallow((s) => s.groups.map(g => g.id))`
- Render `groupIds.map(id => <GroupPane key={id} groupId={id} />)`

### 1B. `src/renderer/components/Terminal/TerminalTabs.tsx`

- Consolidate `groups` + `activeGroupId` into single `useShallow` selector
- Action selectors (lines 30-33) are stable refs -- leave as-is

### 1C. `src/renderer/components/Terminal/TerminalInstance.tsx` (line 19)

- Wrap with `React.memo` -- all props are primitives (`string`, `boolean`, `boolean`)

### 1D. `src/renderer/components/Sidebar/TerminalListItem.tsx`

- Wrap with `React.memo` -- `terminal` is immer-frozen (stable ref when unchanged), `isActive` is boolean

### 1E. `src/renderer/hooks/useShortcuts.ts` (lines 38-54)

- Add manual equality guard in subscribe callback: track `prevTitle`, only call `setWindowTitleSafe` when derived title actually changes
- Zustand 5 `.subscribe()` doesn't support selectors without `subscribeWithSelector` middleware

### Verification
- `npm run build` + `npm test`
- Dev: create 3 groups, type in terminal -- only that pane's components should re-render (React DevTools Profiler)

---

## Batch 2: IPC Safety

### 2A. `src/main/pty-manager.ts` (lines 34, 46)

- Import `IPC_CHANNELS` from `../shared/ipc-types`
- Replace `'pty:data'` with `IPC_CHANNELS.PTY_DATA` (line 34)
- Replace `'pty:exit'` with `IPC_CHANNELS.PTY_EXIT` (line 46)

### 2B. `package.json`

- Add `"postinstall": "electron-builder install-app-deps"` to scripts

### 2C. `src/main/ipc-handlers.ts` (lines 42-43, 57-58)

- Add `MAX_COLS = 500`, `MAX_ROWS = 200` constants
- Clamp with `Math.min(Math.floor(rawCols), MAX_COLS)` in both CREATE (line 42-43) and RESIZE (line 57-58) handlers

### Verification
- `npm run build` + `npm test`
- Grep for remaining hardcoded `'pty:` strings -- should find zero in src/

---

## Batch 3: React Correctness Bugs

### 3A. `src/renderer/components/Terminal/TerminalInstance.tsx` -- Remove double PTY destroy

- Line 152: Remove `ipcApi.destroyPty(terminalId).catch(() => {})` from cleanup
- Store's `removeTerminal`/`removeGroup` already call `destroyPtySafe` -- this is the authoritative path
- Keep all other cleanup (timer, rAF, observer, disposable, unregister, terminal.dispose)

### 3B. `src/renderer/components/Terminal/TerminalInstance.tsx` -- Cancel visibility rAF

- Lines 157-166: Capture rAF ID, return cleanup that cancels it:
  ```
  const id = requestAnimationFrame(...)
  return () => cancelAnimationFrame(id)
  ```
- Add early return when `!isVisible || !fitAddonRef.current`

### 3C. `src/renderer/components/Terminal/TemplateManager.tsx` -- Fix persist stale closure

- Lines 30-39: Replace `isSaving` state guard with `useRef(false)` for the saving guard
- Keep `setIsSaving` for UI display, but use `savingRef.current` for the guard
- Change `useCallback` deps to `[]` (ref is stable)

### 3D. `src/renderer/components/Terminal/TemplateManager.tsx` -- Add error handling to load

- Lines 26-28: Add cancelled flag + `.catch(() => {})`:
  ```
  let cancelled = false
  listTemplatesSafe()
    .then((list) => { if (!cancelled) setTemplates(list) })
    .catch(() => {})
  return () => { cancelled = true }
  ```

### 3E. `src/renderer/components/Terminal/TemplateManager.tsx` -- Use getState() instead of selectors

- Lines 22-24: Remove the three broad store selectors (`groups`, `activeGroupId`, `terminals`)
- In `handleSaveCurrent`, use `useTerminalStore.getState()` to read data on-demand (modal doesn't need live updates)

### 3F. `src/renderer/components/SplitPane/SplitContainer.tsx` -- Error boundary recovery

- Lines 51-57: Add retry button to error fallback
- Use CSS custom properties with fallbacks instead of hardcoded `#cc6666`

### Verification
- `npm run build` + `npm test`
- Close terminal via sidebar X -- confirm single PTY destroy in main process (no double IPC)
- Rapidly toggle groups -- no console errors from stale rAF
- Open/close template manager quickly -- no unhandled rejections

---

## Batch 4: TypeScript Strictness

### 4A. Narrow `ShortcutName` type across IPC boundary

Files to change:
- `src/preload/index.d.ts:11` -- `onShortcut(name: ShortcutName, ...)`, add import
- `src/preload/index.ts:41` -- `onShortcut(name: ShortcutName, ...)` (import already present)
- `src/renderer/lib/ipc-api.ts:9` -- `onShortcutSafe(name: ShortcutName, ...)`, add import
- `src/main/index.ts` -- Type `SHORTCUT_ACCELERATORS` as `Record<ShortcutName, string>`, narrow `sendShortcut` param

### 4B. `src/renderer/components/SplitPane/SplitContainer.tsx` -- Add assertNever

- Lines 14-29: Add explicit `if (node.type === 'branch')` guard + `assertNever(node)` fallback
- Import `assertNever` from `../../lib/tree-utils` (already exported there)

### Verification
- `npm run build` -- confirms narrowed types compile
- `npm test`
- All shortcuts still work in dev

---

## Batch 5: Accessibility

### 5A. `src/renderer/components/Sidebar/SidebarActions.tsx`

- Add `aria-label="New Terminal"` to `+` button (line 9)
- Add `aria-label="New Group"` to `&#8862;` button (line 12)

### 5B. `src/renderer/components/Terminal/TemplateManager.tsx` -- Modal a11y

- Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby="template-manager-title"` to `.template-manager-modal` div
- Add `id="template-manager-title"` to the `<h2>`
- Add `useEffect` for Escape key → `onClose()`
- Add `aria-label` to card action buttons (Edit, Duplicate, Delete)

### 5C. `src/renderer/components/Terminal/TerminalTabs.tsx` -- Tab arrow key navigation

- Add `onKeyDown` handler to tab divs: ArrowLeft/ArrowRight cycle through groups via `setActiveGroup`

### 5D. `src/renderer/components/Terminal/TemplateLauncher.tsx` -- Dropdown keyboard nav

- Add `onKeyDown` to dropdown: ArrowUp/ArrowDown navigate menuitems, Escape closes

### 5E. `src/renderer/assets/styles/sidebar.css` (lines 85-88)

- Change `text-decoration: line-through` to `font-style: italic` (match splitpane.css pattern)

### 5F. `src/renderer/assets/styles/tabs.css`

- Add `.terminal-tab:focus-within .terminal-tab-close { opacity: 1; }` to reveal close button on keyboard focus

### 5G. `src/renderer/assets/styles/template-manager.css`

- Add `:focus-visible` styles for `.template-manager-close`, card action buttons, footer buttons
- Add disabled button styling: `.template-manager-footer button:disabled { opacity: 0.5; cursor: not-allowed; }`

### Verification
- Tab through entire UI with keyboard -- all elements have visible focus indicators
- Escape closes template manager modal
- Arrow keys navigate tabs and dropdown

---

## Batch 6: CSS Polish

### 6A. Replace off-palette colors

- `sidebar.css:25` -- `#bbbbbb` → `var(--tm-text-primary)`
- `terminal.css:49` -- `#555` → `var(--tm-border)`
- `terminal.css:51` -- `#222` → `rgba(0, 0, 0, 0.4)`

### 6B. `src/renderer/assets/styles/splitpane.css` (lines 67-72)

- Remove redundant `outline: none` from combined hover+focus-visible rule

### Verification
- Visual inspection in dev -- no regressions

---

## Files Modified (by batch)

| Batch | Files |
|-------|-------|
| 1 | `TerminalPanel.tsx`, `TerminalTabs.tsx`, `TerminalInstance.tsx`, `TerminalListItem.tsx`, `useShortcuts.ts` |
| 2 | `pty-manager.ts`, `package.json`, `ipc-handlers.ts` |
| 3 | `TerminalInstance.tsx`, `TemplateManager.tsx`, `SplitContainer.tsx` |
| 4 | `preload/index.d.ts`, `preload/index.ts`, `ipc-api.ts`, `main/index.ts`, `SplitContainer.tsx` |
| 5 | `SidebarActions.tsx`, `TemplateManager.tsx`, `TerminalTabs.tsx`, `TemplateLauncher.tsx`, `sidebar.css`, `tabs.css`, `template-manager.css` |
| 6 | `sidebar.css`, `terminal.css`, `splitpane.css` |

## Reusable Utilities

- `assertNever` -- already exported from `src/renderer/lib/tree-utils.ts`
- `useShallow` -- from `zustand/react/shallow` (Zustand 5.0.11, already a dependency)
- `hexToRgba`, `buildGradient` -- from `src/renderer/lib/color-utils.ts`
- `collectLeafIds` -- from `src/renderer/lib/tree-utils.ts`
