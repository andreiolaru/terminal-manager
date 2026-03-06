# Claude Code Integration Implementation Plan

## Context

Claude Code integration adds real-time status detection for terminals running Claude Code CLI. The main process parses PTY output (OSC sequences + text patterns) to determine if each Claude instance is idle, working, waiting for input, or done. Status changes trigger Windows toast notifications and visual indicators in the UI. Full spec: `docs/prd-claude-code-integration.md`.

### Dependencies

This feature builds on the **Layout Templates** feature, which already added:
- `claudeCode?: boolean` on `TerminalInfo` and `TerminalSlot`
- `startupCommand` execution in `TerminalInstance`
- `registerFirstDataCallback` in `pty-dispatcher`

The Layout Templates feature is partially implemented (types, store, IPC, startup commands, group visuals, launcher, and manager are all in place). This plan assumes it is complete.

### Current Codebase State

Key patterns to preserve:
- **Main process** owns PTY lifecycle (`PtyManager`) and IPC handlers. The detector and notification manager belong here.
- **Centralized IPC dispatcher** (`pty-dispatcher.ts`) handles `onPtyData`/`onPtyExit` with Map-based O(1) routing. Claude status events follow the same pattern.
- **Preload bridge** exposes typed `electronAPI` — all renderer-main communication goes through it.
- **Store** (`terminal-store.ts`) uses Zustand + immer. Claude status is store state, not component state.
- **CSS custom properties** (`--tm-*` prefix) for theming. Claude status CSS follows same convention.

---

## Implementation Steps

### Step 1: Types & IPC Channels

**Modify `src/shared/ipc-types.ts`** — add Claude Code and notification IPC channel constants:

```typescript
// Add to IPC_CHANNELS:
CLAUDE_REGISTER: 'claude:register',
CLAUDE_UNREGISTER: 'claude:unregister',
CLAUDE_STATUS: 'claude:status',
NOTIFICATION_FOCUS_TERMINAL: 'notification:focus-terminal',
NOTIFICATION_ACTIVE_TERMINAL: 'notification:active-terminal',
```

**Modify `src/renderer/store/types.ts`** — extend `TerminalInfo` and `TerminalState`:

```typescript
// New type (can live in types.ts or a separate file, but types.ts is simplest)
type ClaudeCodeStatus = 'not-tracked' | 'idle' | 'working' | 'needs-input' | 'completed'

// Add to TerminalInfo:
claudeStatus?: ClaudeCodeStatus
claudeStatusTitle?: string   // auto-detected context (e.g., "Allow Read tool?")

// Add to TerminalState:
setClaudeStatus: (id: TerminalId, status: ClaudeCodeStatus, contextTitle?: string) => void
```

`claudeCode?: boolean` and `claudeStatus` are both on `TerminalInfo`. `claudeCode` means "this terminal should be tracked". `claudeStatus` is the current detected status (undefined for non-tracked terminals).

### Step 2: Claude Code Detector (Main Process)

**Create `src/main/claude-detector.ts`** — the core detection engine.

This is a pure-logic class with no Electron dependencies (makes it unit-testable). It receives raw PTY data and emits status change events via a callback.

**Architecture:**
- `feed(terminalId, rawData)` — called on every `pty.onData` for registered terminals
- `onWrite(terminalId)` — called when the user writes to a tracked terminal (resets `needs-input`)
- `register(terminalId)` / `unregister(terminalId)` — start/stop tracking
- `onStatusChange: (id, status, contextTitle?) => void` — callback for status transitions

**Two-phase parsing:**
1. **Phase 1 (OSC extraction)**: Parse raw PTY data for OSC sequences before ANSI stripping. Extract terminal title (OSC 0) and desktop notifications (OSC 9/99/777).
2. **Phase 2 (text patterns)**: Strip ANSI from remaining data, append to rolling 2KB buffer, match secondary patterns (input box border chars, thinking spinner).

**State machine per terminal:**
- Tracks `state`, `silenceTimer`, `lastDataTime`, `buffer`
- Braille spinner in OSC title = `working` (highest confidence)
- OSC 9/99/777 = `completed`
- Input box chars + 500ms silence after `working` = `needs-input`
- User writes to `needs-input`/`completed` terminal = `working`
- 5s silence after `completed` = `idle`

**Key functions to export (for testing):**
- `extractOscSignals(raw)` — returns `{ title?, notifications[] }`
- `stripAnsi(str)` — removes CSI, OSC, charset sequences
- `ClaudeCodeDetector` class

**Braille spinner charset:**
```
U+2807 U+2819 U+2839 U+2838 U+283C U+2834 U+2826 U+2827 U+2847 U+280F
```

### Step 3: Notification Manager (Main Process)

**Create `src/main/notification-manager.ts`** — Windows toast notifications.

Uses Electron's `Notification` API (main process, not renderer Web Notification).

**Key behaviors:**
- Only notifies for `needs-input` and `completed`
- Suppresses if window is focused (`isFocused() && !isMinimized()`) AND the terminal is already active
- Replaces existing notification for same terminal (prevents stacking)
- 3-second debounce per terminal to prevent spam
- Click handler: `restore()` + `show()` + `focus()` + send `notification:focus-terminal` to renderer

**Modify `src/main/index.ts`**:
- Add `app.setAppUserModelId('com.terminal-manager.app')` before `app.whenReady()` — required for Windows toast notifications in dev mode
- Instantiate `NotificationManager`, pass it the `BrowserWindow`
- Pass `notificationManager` to `registerIpcHandlers`

**Wire detector to notification manager:**
- `ClaudeCodeDetector.onStatusChange` calls `notificationManager.notify()`
- Both are instantiated in `index.ts` and connected there

### Step 4: PtyManager Integration

**Modify `src/main/pty-manager.ts`** — feed data to detector, intercept writes.

The `PtyManager` needs to know about the detector so it can:
1. Call `detector.feed(id, data)` inside `ptyProcess.onData`
2. Call `detector.onWrite(id)` inside `write(id, data)` for user input detection

**Approach:** Pass the detector to PtyManager via a setter method (same pattern as `setWindow()`):

```typescript
setDetector(detector: ClaudeCodeDetector): void {
  this.detector = detector
}
```

In `create()`:
```typescript
ptyProcess.onData((data) => {
  this.window?.webContents.send('pty:data', id, data)
  this.detector?.feed(id, data)  // <-- new
})
```

In `write()`:
```typescript
write(id: string, data: string): void {
  this.ptys.get(id)?.write(data)
  this.detector?.onWrite(id)  // <-- new
}
```

### Step 5: IPC & Preload Updates

**Modify `src/main/ipc-handlers.ts`** — register Claude Code IPC handlers:
- `claude:register` — `ipcMain.on` (fire-and-forget), calls `detector.register(id)`
- `claude:unregister` — `ipcMain.on`, calls `detector.unregister(id)`
- `notification:active-terminal` — `ipcMain.on`, calls `notificationManager.setActiveTerminal(id)`

`claude:status` is NOT an ipcMain handler — it's `webContents.send` from main to renderer (push direction).

**Modify `src/preload/index.ts`** — add:
```typescript
registerClaude(id: string): void {
  ipcRenderer.send(IPC_CHANNELS.CLAUDE_REGISTER, id)
}

unregisterClaude(id: string): void {
  ipcRenderer.send(IPC_CHANNELS.CLAUDE_UNREGISTER, id)
}

onClaudeStatus(callback: (id: string, status: ClaudeCodeStatus, contextTitle?: string) => void): () => void {
  // standard on/removeListener pattern
}

onNotificationFocusTerminal(callback: (id: string) => void): () => void {
  // standard on/removeListener pattern
}

setActiveTerminalForNotifications(id: string | null): void {
  ipcRenderer.send(IPC_CHANNELS.NOTIFICATION_ACTIVE_TERMINAL, id)
}
```

**Modify `src/preload/index.d.ts`** — add type declarations for above.

**Modify `src/renderer/__tests__/setup.ts`** — mock the new electronAPI methods.

### Step 6: Store Actions

**Modify `src/renderer/store/terminal-store.ts`**:

Add `setClaudeStatus(id, status, contextTitle?)`:
```typescript
setClaudeStatus: (id, status, contextTitle) => {
  set((state) => {
    if (state.terminals[id]) {
      state.terminals[id].claudeStatus = status
      state.terminals[id].claudeStatusTitle = contextTitle
    }
  })
}
```

### Step 7: Claude Status Dispatcher (Renderer)

**Create `src/renderer/lib/claude-status-dispatcher.ts`** — listens for `claude:status` and `notification:focus-terminal` IPC events and updates the store.

Follows the same pattern as `pty-dispatcher.ts` (module-level singleton with `init`/cleanup).

```typescript
export function initClaudeStatusDispatcher(): () => void {
  const unsubStatus = ipcApi.onClaudeStatus((id, status, contextTitle) => {
    useTerminalStore.getState().setClaudeStatus(id, status, contextTitle)
  })

  const unsubFocus = ipcApi.onNotificationFocusTerminal((terminalId) => {
    // Find which group contains this terminal, switch to it
    const state = useTerminalStore.getState()
    state.setActiveTerminal(terminalId)
  })

  return () => { unsubStatus(); unsubFocus() }
}
```

**Initialize in `App.tsx`** or wherever `pty-dispatcher` is initialized — call `initClaudeStatusDispatcher()` on mount.

Also: **push `activeTerminalId` to main** on every change. Add an effect/subscription that watches `activeTerminalId` and sends `notification:active-terminal` to main.

### Step 8: TerminalInstance — Claude Registration

**Modify `src/renderer/components/Terminal/TerminalInstance.tsx`**:

After `createPty()` succeeds, if `terminalInfo.claudeCode` is true, call `ipcApi.registerClaude(terminalId)`.

On unmount, if claude was registered, call `ipcApi.unregisterClaude(terminalId)`.

```typescript
// In the mount useEffect, after createPty:
if (terminalInfo?.claudeCode) {
  ipcApi.registerClaude(terminalId)
}

// In cleanup:
if (terminalInfo?.claudeCode) {
  ipcApi.unregisterClaude(terminalId)
}
```

### Step 9: Status Icons in TerminalPane

**Modify `src/renderer/components/Terminal/TerminalPane.tsx`**:

Read `claudeStatus` from store. Render status icon before title. Add status-based CSS classes.

```tsx
const claudeStatus = useTerminalStore((s) => s.terminals[terminalId]?.claudeStatus)

// In className:
const statusClass = claudeStatus && claudeStatus !== 'not-tracked'
  ? ` claude-${claudeStatus}`
  : ''
const className = `terminal-pane${isActive ? ' active' : ''}${!isAlive ? ' dead' : ''}${statusClass}`

// Before title span:
{claudeStatus && claudeStatus !== 'not-tracked' && (
  <span className={`claude-status-icon ${claudeStatus}`}>
    {statusIcons[claudeStatus]}
  </span>
)}
```

Status icon map (Unicode characters):
```typescript
const statusIcons: Record<string, string> = {
  idle: '\u25CF',        // filled circle
  working: '\u25C6',     // filled diamond
  'needs-input': '\u25C8', // circle in circle
  completed: '\u2713',   // check mark
}
```

### Step 10: Status CSS

**Create `src/renderer/assets/styles/claude-status.css`**:

```css
/* Status icons */
.claude-status-icon {
  font-size: 10px;
  flex-shrink: 0;
  line-height: 1;
}

.claude-status-icon.idle { color: #6e7681; }
.claude-status-icon.working { color: #58a6ff; }
.claude-status-icon.needs-input {
  color: #d29922;
  animation: claude-status-pulse 1.5s ease-in-out infinite;
}
.claude-status-icon.completed { color: #3fb950; }

@keyframes claude-status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Title bar tinting by status */
.terminal-pane.claude-needs-input .terminal-title-bar {
  background: linear-gradient(90deg, rgba(210, 153, 34, 0.15), transparent 60%),
              linear-gradient(var(--tm-group-color-bg, transparent), var(--tm-group-color-bg, transparent)),
              var(--tm-titlebar-bg);
}

.terminal-pane.claude-completed .terminal-title-bar {
  background: linear-gradient(90deg, rgba(63, 185, 80, 0.10), transparent 60%),
              linear-gradient(var(--tm-group-color-bg, transparent), var(--tm-group-color-bg, transparent)),
              var(--tm-titlebar-bg);
}
```

Import in `TerminalPane.tsx`.

### Step 11: Group Tab Attention Badge

**Modify `src/renderer/components/Terminal/TerminalTabs.tsx`**:

Derive attention status from all terminals in a group:

```tsx
// Inside the group tab render:
const attentionStatus = useTerminalStore((s) => {
  const leafIds = collectLeafIds(group.splitTree)
  const statuses = leafIds.map(id => s.terminals[id]?.claudeStatus)
  if (statuses.includes('needs-input')) return 'needs-input'
  if (statuses.includes('completed')) return 'completed'
  return null
})

// Render badge:
{attentionStatus && (
  <span className={`terminal-tab-attention ${attentionStatus}`} />
)}
```

**Add to `tabs.css`**:

```css
.terminal-tab-attention {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.terminal-tab-attention.needs-input {
  background: #d29922;
  animation: claude-status-pulse 1.5s ease-in-out infinite;
}

.terminal-tab-attention.completed {
  background: #3fb950;
}
```

### Step 12: Tests

**Create `src/main/__tests__/claude-detector.test.ts`**:

1. **OSC extraction** — `extractOscSignals()` correctly parses title and notification sequences
2. **ANSI stripping** — `stripAnsi()` removes CSI, OSC, charset sequences
3. **State machine transitions:**
   - `idle` -> feed OSC title with spinner -> `working`
   - `working` -> feed OSC 9 notification -> `completed`
   - `working` -> feed input box chars + wait 500ms -> `needs-input`
   - `needs-input` -> call `onWrite()` -> `working`
   - `completed` -> wait 5s -> `idle`
4. **Buffer management** — buffer doesn't grow beyond 2KB
5. **Register/unregister** — unregistered terminals are not tracked

**Create `src/main/__tests__/notification-manager.test.ts`**:

1. **Suppression** — no notification when window focused + terminal active
2. **Debounce** — only one notification per 3 seconds per terminal
3. **Status filter** — only `needs-input` and `completed` trigger notifications
4. **Duplicate replacement** — second notification closes the first

**Modify existing renderer tests**:
- Store test for `setClaudeStatus`
- Component test for status icon rendering and attention badge

---

## Files Summary

### New Files (4)

| File | Purpose |
|------|---------|
| `src/main/claude-detector.ts` | PTY output parser, state machine, OSC extraction, ANSI stripping |
| `src/main/notification-manager.ts` | Windows toast notifications, click-to-focus, suppression |
| `src/renderer/lib/claude-status-dispatcher.ts` | Listen for `claude:status` IPC, update store |
| `src/renderer/assets/styles/claude-status.css` | Status icons, pulse animation, title bar tinting |

### New Test Files (2)

| File | Purpose |
|------|---------|
| `src/main/__tests__/claude-detector.test.ts` | Detector state machine + OSC/ANSI parsing |
| `src/main/__tests__/notification-manager.test.ts` | Notification suppression + debounce logic |

### Modified Files (12)

| File | Changes |
|------|---------|
| `src/shared/ipc-types.ts` | 5 new IPC channel constants |
| `src/renderer/store/types.ts` | `ClaudeCodeStatus` type, `claudeStatus`/`claudeStatusTitle` on `TerminalInfo`, `setClaudeStatus` action |
| `src/renderer/store/terminal-store.ts` | `setClaudeStatus()` implementation |
| `src/main/index.ts` | `setAppUserModelId`, instantiate detector + notification manager, wire together |
| `src/main/pty-manager.ts` | `setDetector()`, feed data to detector, intercept writes |
| `src/main/ipc-handlers.ts` | 3 new IPC handlers (claude:register, claude:unregister, notification:active-terminal) |
| `src/preload/index.ts` | 5 new bridge methods |
| `src/preload/index.d.ts` | Type declarations for new methods |
| `src/renderer/__tests__/setup.ts` | Mock new electronAPI methods |
| `src/renderer/components/Terminal/TerminalPane.tsx` | Status icon, status CSS classes |
| `src/renderer/components/Terminal/TerminalTabs.tsx` | Attention badge per group tab |
| `src/renderer/assets/styles/tabs.css` | Attention badge styles |
| `src/renderer/components/Terminal/TerminalInstance.tsx` | Claude register/unregister on mount/unmount |

---

## Step Grouping & Verification

### Group A: Types + Core Detection (Steps 1-2)
Create the types and detector class. The detector is pure logic with no Electron deps — fully unit testable.

**Verify:** `npm test` — run `claude-detector.test.ts`.

### Group B: Notification Manager (Step 3)
Build notification manager. Depends on Electron APIs so harder to unit test, but suppression/debounce logic can be tested.

**Verify:** `npm test` — run `notification-manager.test.ts`.

### Group C: Integration Wiring (Steps 4-5)
Connect detector to PtyManager, add IPC handlers, update preload bridge.

**Verify:** `npm run dev` — no IPC registration errors in DevTools. Mark a terminal as `claudeCode: true` in a template. Launch it, verify no crashes.

### Group D: Store + Dispatcher (Steps 6-7)
Add store action, create renderer-side dispatcher for status events.

**Verify:** `npm run dev` — launch a Claude Code template. In main process debugger, manually emit a `claude:status` event. Verify store updates (check via DevTools > React DevTools or `useTerminalStore.getState()`).

### Group E: Registration + UI (Steps 8-11)
Wire TerminalInstance registration, add status icons, title bar tinting, attention badges.

**Verify:** `npm run dev` — launch a Claude Code terminal (template with `startupCommand: "claude"`). Observe:
- Status icon appears in title bar
- Icon color changes as Claude works/waits
- Amber pulse on `needs-input`
- Group tab shows attention badge
- Windows notification pops up when window is unfocused/minimized
- Clicking notification focuses the correct terminal

### Group F: Tests (Step 12)
Complete test coverage.

**Verify:** `npm test` — all tests pass.

---

## Design Decisions & Rationale

### Detector in Main Process (not Renderer)
The detector runs in main because:
1. Raw PTY data is already there — no extra IPC for detection input
2. Can trigger notifications directly without round-trip to renderer
3. Doesn't load the renderer's event loop with parsing work
4. The renderer only receives processed status updates (simple string enum)

### Detector Receives PtyManager (not the other way around)
PtyManager calls `detector.feed()` rather than the detector subscribing to PTY events. This keeps PtyManager as the single owner of PTY lifecycle and avoids the detector needing knowledge of the IPC layer.

### `setDetector()` Setter Pattern
Same pattern as existing `setWindow()` on PtyManager. Avoids circular constructor dependencies between PtyManager, detector, and notification manager.

### Notification from Main Process (not Renderer)
Using Electron's main-process `Notification` class instead of renderer's Web Notification API because:
1. `setPermissionRequestHandler` currently denies all permissions — would need a carve-out
2. Main process already has the data and can notify without IPC round-trips
3. Click handler has direct `BrowserWindow` access for focus management

### Claude Status Dispatcher Pattern
Follows the exact same pattern as `pty-dispatcher.ts` — module-level singleton, init/cleanup functions, Map-based routing. Keeps the renderer's IPC consumption consistent.

### `collectLeafIds` for Attention Badge
Reuses the existing `collectLeafIds()` from `tree-utils.ts`. The selector runs in the group tab render and checks all terminals in the group for status. This is cheap (groups typically have <10 terminals) and avoids derived-state tracking complexity.

---

## Caveats & Risk Areas

### OSC Parsing Reliability
Claude Code's OSC title with Braille spinner is the highest-confidence signal, but Claude Code could change its output format. The detector should be designed for graceful degradation — if OSC parsing fails to detect status, the terminal just stays untracked (no crashes, no false positives).

### Notification Spam
Rapid state transitions (e.g., Claude briefly showing an input prompt then immediately continuing) could cause notification churn. The 3-second debounce + 500ms silence timer before confirming `needs-input` should prevent this, but it needs real-world testing with actual Claude Code sessions.

### `isFocused()` Windows Bug
`BrowserWindow.isFocused()` returns `true` even when minimized on Windows (electron/electron#20464). The plan accounts for this with `isFocused() && !isMinimized()`, but this is a known Electron bug that could regress.

### Startup Command + Claude Registration Timing
When a template launches a Claude Code terminal with `startupCommand: "claude"`, registration happens immediately after PTY creation. But the first `pty:data` callback fires before `claude` actually starts (it's the shell prompt). The detector handles this gracefully — it starts in `idle` and transitions to `working` when it sees the first OSC title with spinner.

### Test Timing Sensitivity
The detector uses timers (500ms silence, 5s idle transition). Tests need to use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` to avoid real delays.
