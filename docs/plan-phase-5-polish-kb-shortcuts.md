# Phase 5: Polish + Keyboard Shortcuts

## Context

Phases 1-4 are complete: the terminal manager has single/multiple terminals, sidebar, split panes (allotment), and terminal groups/tabs. Phase 5 adds keyboard-driven workflow and visual polish to make the app feel complete. The user chose **Electron Menu accelerators** as the shortcut mechanism (most reliable, fires before DOM events, works regardless of xterm focus).

---

## Architecture Decision: Electron Menu Accelerators

All shortcuts are registered as hidden Electron Menu items with `accelerator` strings. When a shortcut fires, the main process sends an IPC message (`shortcut:*`) to the renderer. The renderer listens via a new `useShortcuts()` hook and dispatches Zustand store actions.

Additionally, xterm's `attachCustomKeyEventHandler` is added to prevent terminals from consuming shortcut key combos (especially `Alt+Arrow` which generates escape sequences).

---

## Implementation Steps

### Step 1: Tree Navigation Algorithm (`src/renderer/lib/tree-utils.ts`)

Add `findAdjacentTerminal(tree, currentId, direction)` — pure function for directional pane navigation.

**Algorithm:**
1. Build path from root to current leaf
2. Walk up to find nearest ancestor branch whose `direction` matches the navigation axis AND current leaf is on the "departing" side
3. Cross to sibling subtree
4. Drill down to the nearest edge leaf (opposite side from navigation direction)

**New exports:**
- `findAdjacentTerminal(tree: SplitNode, currentId: TerminalId, direction: NavigationDirection): TerminalId | null`

**Direction mapping:**
- `left`/`right` → look for `horizontal` branches
- `up`/`down` → look for `vertical` branches

### Step 2: Store Additions (`src/renderer/store/types.ts` + `terminal-store.ts`)

**New type** in `types.ts`:
```typescript
export type NavigationDirection = 'left' | 'right' | 'up' | 'down'
```

**New actions** in `TerminalState` interface:
```typescript
cycleGroup: (delta: 1 | -1) => void
navigatePane: (direction: NavigationDirection) => void
```

**`cycleGroup(delta)`** implementation:
- Find current index in `groups`, compute `(index + delta + length) % length`, set `activeGroupId`
- No-op if 0 or 1 groups

**`navigatePane(direction)`** implementation:
- Get active group's `splitTree` and `activeTerminalId`
- Call `findAdjacentTerminal(splitTree, activeTerminalId, direction)`
- If result is non-null, call `setActiveTerminal(result)`

### Step 3: Focus Management (`TerminalPane.tsx` + `TerminalInstance.tsx`)

**Problem:** When switching panes within the same group (via Alt+Arrow or click), the xterm instance in the new pane needs `.focus()`. Currently focus is only triggered on visibility changes (group switches).

**Fix:** Pass `isActive` prop from `TerminalPane` down to `TerminalInstance`. Add a `useEffect` in `TerminalInstance`:
```typescript
useEffect(() => {
  if (isActive && isVisible && terminalRef.current) {
    terminalRef.current.focus()
  }
}, [isActive, isVisible])
```

Files:
- `src/renderer/components/Terminal/TerminalPane.tsx` — pass `isActive` to `TerminalInstance`
- `src/renderer/components/Terminal/TerminalInstance.tsx` — add `isActive` prop, add focus effect, add `attachCustomKeyEventHandler`

### Step 4: Preload API Extensions (`src/preload/index.ts` + `index.d.ts`)

Add to `ElectronAPI`:
```typescript
onShortcut(name: string, callback: () => void): () => void
setWindowTitle(title: string): void
```

`onShortcut` validates channel name against a whitelist of known shortcut names, then wraps `ipcRenderer.on('shortcut:<name>', callback)`.

`setWindowTitle` calls `ipcRenderer.send('window:set-title', title)`.

### Step 5: Main Process — Menu & IPC (`src/main/index.ts` + `ipc-handlers.ts`)

**Hidden Electron Menu** with accelerators:

| Shortcut | Accelerator | IPC Channel |
|----------|-------------|-------------|
| Ctrl+Shift+T | `CmdOrCtrl+Shift+T` | `shortcut:new-terminal` |
| Ctrl+Shift+W | `CmdOrCtrl+Shift+W` | `shortcut:close-terminal` |
| Ctrl+Shift+D | `CmdOrCtrl+Shift+D` | `shortcut:split-right` |
| Ctrl+Shift+E | `CmdOrCtrl+Shift+E` | `shortcut:split-down` |
| Ctrl+Tab | `Ctrl+Tab` | `shortcut:cycle-group-forward` |
| Ctrl+Shift+Tab | `Ctrl+Shift+Tab` | `shortcut:cycle-group-backward` |
| Alt+Left | `Alt+Left` | `shortcut:navigate-left` |
| Alt+Right | `Alt+Right` | `shortcut:navigate-right` |
| Alt+Up | `Alt+Up` | `shortcut:navigate-up` |
| Alt+Down | `Alt+Down` | `shortcut:navigate-down` |

In `index.ts`:
- Import `Menu` from electron
- Build menu template with `visible: false` items
- Set `Menu.setApplicationMenu(menu)` after window creation
- Add `autoHideMenuBar: true` to BrowserWindow options
- Store `mainWindow` reference for menu item click handlers

In `ipc-handlers.ts`:
- Add `ipcMain.on('window:set-title', ...)` handler that calls `BrowserWindow.fromWebContents(event.sender)?.setTitle(title)`

### Step 6: Renderer Hook (`src/renderer/hooks/useShortcuts.ts` — NEW)

Single hook that:
1. Subscribes to all `shortcut:*` IPC channels via `ipcApi.onShortcut()`
2. Maps each to the corresponding store action using `useTerminalStore.getState()` for current state
3. Manages window title: subscribes to store changes, sends title to main via `ipcApi.setWindowTitle()`

**Shortcut → action mapping:**

| IPC Channel | Store Action |
|-------------|-------------|
| `new-terminal` | `getState().addTerminal()` |
| `close-terminal` | `getState().removeTerminal(activeTerminalId)` |
| `split-right` | `getState().splitTerminal(activeTerminalId, 'horizontal')` |
| `split-down` | `getState().splitTerminal(activeTerminalId, 'vertical')` |
| `cycle-group-forward` | `getState().cycleGroup(1)` |
| `cycle-group-backward` | `getState().cycleGroup(-1)` |
| `navigate-left` | `getState().navigatePane('left')` |
| `navigate-right` | `getState().navigatePane('right')` |
| `navigate-up` | `getState().navigatePane('up')` |
| `navigate-down` | `getState().navigatePane('down')` |

**Window title format:** `{terminal title} - Terminal Manager` (fallback: `Terminal Manager`)

Wire into `App.tsx` alongside existing `usePtyIpc()`.

### Step 7: xterm Key Filter (`src/renderer/components/Terminal/TerminalInstance.tsx`)

Add `attachCustomKeyEventHandler` after `new Terminal()`, before `terminal.open()`:

Return `false` (let pass through, don't process) for:
- `Ctrl+Shift+T/W/D/E`
- `Ctrl+Tab`, `Ctrl+Shift+Tab`
- `Alt+Arrow` keys

This prevents xterm from sending escape sequences for these combos.

### Step 8: Visual Polish (CSS + minor TSX)

**`splitpane.css`:**
- Add `transition: border-color 0.15s ease` to `.terminal-title-bar`
- Add `.terminal-pane.dead .terminal-title-bar .title { opacity: 0.5; font-style: italic; }`
- Add `:focus-visible` styles on `.terminal-title-actions button`

**`tabs.css`:**
- Add `.terminal-tab.active .terminal-tab-close { opacity: 1; }` (always show close on active tab)
- Add `:focus-visible` on `.terminal-tab-close` and `.terminal-tab-add`

**`global.css`:**
- Add `::selection { background: #264f78; color: #ffffff; }`
- Add allotment overrides: `--focus-border: #007acc; --sash-size: 6px; --sash-hover-size: 3px;`

**`sidebar.css`:**
- Add custom scrollbar styling for `.terminal-list` (thin dark scrollbar)

**`terminal.css`:**
- Add `<kbd>` styling for empty state hint

**Component updates:**
- `TerminalPanel.tsx` — update empty state text: `Press Ctrl+Shift+T or click "+" to create a terminal.` with `<kbd>` elements
- `TerminalPane.tsx` — add dead-terminal class logic (`isAlive` check), update button `title` attrs with shortcut hints
- `SidebarActions.tsx` — update button `title` attrs with shortcut hints
- `TerminalTabs.tsx` — update "+" button `title` attr

---

## Files Modified (Summary)

| File | Type | Changes |
|------|------|---------|
| `src/renderer/lib/tree-utils.ts` | Edit | Add `findAdjacentTerminal()` + helpers |
| `src/renderer/store/types.ts` | Edit | Add `NavigationDirection`, `cycleGroup`, `navigatePane` |
| `src/renderer/store/terminal-store.ts` | Edit | Implement `cycleGroup`, `navigatePane` |
| `src/renderer/hooks/useShortcuts.ts` | **New** | Shortcut IPC subscriptions + window title tracking |
| `src/renderer/App.tsx` | Edit | Import and call `useShortcuts()` |
| `src/renderer/components/Terminal/TerminalInstance.tsx` | Edit | `isActive` prop, focus effect, `attachCustomKeyEventHandler` |
| `src/renderer/components/Terminal/TerminalPane.tsx` | Edit | Pass `isActive`, dead class, tooltip hints |
| `src/renderer/components/Terminal/TerminalPanel.tsx` | Edit | Empty state text with kbd hint |
| `src/renderer/components/Sidebar/SidebarActions.tsx` | Edit | Tooltip hints |
| `src/renderer/components/Terminal/TerminalTabs.tsx` | Edit | Tooltip hint on "+" |
| `src/preload/index.ts` | Edit | Add `onShortcut()`, `setWindowTitle()` |
| `src/preload/index.d.ts` | Edit | Update `ElectronAPI` interface |
| `src/main/index.ts` | Edit | Add `Menu`, `autoHideMenuBar`, store window ref |
| `src/main/ipc-handlers.ts` | Edit | Add `window:set-title` handler |
| `src/renderer/assets/styles/splitpane.css` | Edit | Transitions, dead state, focus-visible |
| `src/renderer/assets/styles/tabs.css` | Edit | Active tab close visibility, focus-visible |
| `src/renderer/assets/styles/global.css` | Edit | Selection color, allotment overrides |
| `src/renderer/assets/styles/sidebar.css` | Edit | Custom scrollbar |
| `src/renderer/assets/styles/terminal.css` | Edit | kbd styling |

---

## Verification

1. `npm run dev` — app launches without errors
2. **Shortcut testing:**
   - `Ctrl+Shift+T` creates new terminal in active group
   - `Ctrl+Shift+W` closes active terminal (test: last terminal removes group, last group shows empty state)
   - `Ctrl+Shift+D` splits active pane right
   - `Ctrl+Shift+E` splits active pane down
   - `Ctrl+Tab` / `Ctrl+Shift+Tab` cycles groups (wraps around)
   - `Alt+Arrow` navigates between split panes (test: 2x2 grid, all 4 directions)
   - All shortcuts work while xterm has focus
3. **Focus:** switching panes focuses the xterm (cursor blinks, typing works immediately)
4. **Window title:** changes when switching terminals/groups, shows "Terminal Manager" when empty
5. **Visual:** active pane border transition is smooth, dead terminals show italic title, active tab always shows close button, scrollbars match dark theme
6. **Edge cases:** Alt+Arrow at boundary is no-op, Ctrl+Tab with 1 group is no-op, close last terminal in last group shows empty state
7. Run existing tests: `npx vitest run` — all pass
8. Add tests for `findAdjacentTerminal` and `cycleGroup`
