# Claude Code Integration — PRD

## Overview

The primary use case for this terminal manager is managing multiple **Claude Code** CLI sessions. Terminals running Claude Code get real-time status detection — the app parses PTY output to determine whether each Claude instance is idle, working, waiting for input, or done. Status changes trigger **Windows toast notifications** so you can click a notification to jump straight to the terminal that needs attention.

**Example**: A group has 3 Claude Code terminals working on different repos. When any Claude instance asks a question or needs tool approval, the title bar pulses amber, the group tab shows an attention badge, and a Windows notification pops up: "Claude needs your input — API Server". Click the notification and you're focused on that exact terminal.

This feature depends on the Layout Templates feature for `claudeCode: true` terminal marking and startup commands — see [prd-layout-templates.md](./prd-layout-templates.md).

---

## Data Model

### Claude Code Status

```typescript
type ClaudeCodeStatus = 'not-tracked' | 'idle' | 'working' | 'needs-input' | 'completed'
```

### TerminalInfo Extensions

```typescript
interface TerminalInfo {
  // ... existing fields ...
  claudeCode?: boolean                // is this a Claude Code session?
  claudeStatus?: ClaudeCodeStatus     // current detected status
  claudeStatusTitle?: string          // auto-detected context (e.g., "Waiting: Allow Read tool?")
}
```

---

## Status Detection

### Architecture

Status detection happens in the **main process** where PTY data flows through `PtyManager`. A new `ClaudeCodeDetector` class intercepts the PTY output stream for terminals marked as Claude Code sessions.

```
PTY output -> PtyManager.onData
                |-- webContents.send('pty:data')      -> renderer (xterm)
                \-- ClaudeCodeDetector.feed(id, data) -> status analysis
                     \-- status changed?
                        |-- webContents.send('claude:status', id, status)  -> renderer (store)
                        \-- NotificationManager.notify(id, status)        -> Windows toast
```

The detector runs **in the main process** because:
1. It already has access to raw PTY output — no extra IPC needed
2. It can trigger notifications directly without round-tripping to the renderer
3. It doesn't add weight to the renderer's event loop

### Detection Strategy

Claude Code is a **full-screen React + Ink application** that takes raw terminal control. It doesn't produce simple scrolling text — it redraws the entire visible area on state changes using cursor movement and ANSI sequences. This means simple line-by-line regex won't work reliably.

However, Claude Code emits highly reliable **OSC (Operating System Command) escape sequences** in the PTY stream that we can intercept before they reach xterm.js. These are the primary detection signals.

#### Primary Detection: OSC Sequences

| Signal | Sequence | State | Confidence |
|--------|----------|-------|------------|
| **Terminal title with Braille spinner** | `\x1B]0;Claude Code <spinner>\x07` | `working` | Very High |
| **Terminal title without spinner** | `\x1B]0;Claude Code\x07` | `idle` | Very High |
| **OSC 9 notification** | `\x1B]9;message\x07` | `completed` | Very High |
| **OSC 777 notification** | `\x1B]777;notify;title;message\x07` | `completed` | Very High |
| **OSC 99 notification** | `\x1B]99;...` | `completed` | Very High |

The Braille spinner characters cycle through: `<U+2807> <U+2819> <U+2839> <U+2838> <U+283C> <U+2834> <U+2826> <U+2827> <U+2847> <U+280F>`. When Claude Code is thinking, it sets the terminal title to include one of these — when it stops, the title reverts. This is the **most reliable working indicator**.

OSC 9/99/777 are desktop notification sequences that Claude Code emits on task completion. Since we control the PTY layer, we intercept these before xterm processes them.

#### Secondary Detection: Visual Patterns

| Signal | Characters | State | Confidence |
|--------|-----------|-------|------------|
| **Rounded input box** | `<U+256D> <U+2500> <U+256E> <U+2502> <U+2570> <U+256F>` (Ink `borderStyle="round"`) | `idle` / `needs-input` | High |
| **Thinking spinner** | `<U+00B7> <U+2722> <U+2733> <U+2217> <U+273B> <U+273D>` appended to verb (e.g., "Thinking<U+2722>") | `working` | High |
| **Permission prompt text** | "Allow" / approval UI rendering | `needs-input` | Medium |

**Note:** The thinking spinner verbs are user-configurable (`~/.claude/settings.json` -> `spinnerVerbs`), so they should not be the sole detection mechanism.

#### Claude Code Hooks (Alternative/Complementary Approach)

Claude Code has a built-in hooks system that fires notifications with structured data:

| Hook `notification_type` | Meaning |
|--------------------------|---------|
| `permission_prompt` | Claude is blocked waiting for tool approval |
| `idle_prompt` | Input prompt idle for 60+ seconds |
| `elicitation_dialog` | Claude is asking the user a question |

**Strategy**: Configure a Claude Code `Notification` hook that writes status to a file (e.g., `/tmp/claude-status-{sessionId}.json`). The main process can watch this file for instant, structured status updates. This is more reliable than PTY parsing for `needs-input` detection.

However, hooks require per-user Claude Code configuration and the `idle_prompt` only fires after 60s (too slow). **OSC parsing remains the primary approach**, with hooks as an optional enhancement.

#### Detection Implementation

```typescript
interface ClaudeCodeSignals {
  // OSC-based (primary -- parsed from raw PTY stream before ANSI stripping)
  oscTitleSpinner: RegExp      // \x1B]0;.*[braille chars].*\x07
  oscNotification: RegExp      // \x1B](9|99|777);.*\x07
  // Text-based (secondary -- matched after ANSI stripping)
  inputBoxChars: RegExp        // rounded border characters
  thinkingSpinner: RegExp      // spinner chars adjacent to text
  permissionPrompt: RegExp     // "Allow" / approval patterns
}
```

#### State Machine

```
                    +----------------------+
                    |     NOT TRACKED      |
                    |  (claudeCode=false)  |
                    +----------------------+

+--------------------------------------------------------------+
|                  TRACKED TERMINALS                            |
|                                                               |
|   IDLE --(OSC title with spinner)--> WORKING                 |
|    ^                                    |                     |
|    |                                    |--(input box chars   |
|    |                                    |  + silence > 500ms  |
|    |                                    |  + no spinner in    |
|    |                                    |  OSC title)--> NEEDS INPUT  |
|    |                                    |                     |
|    |                                    \--(OSC 9/99/777      |
|    |                                       notification)--> COMPLETED |
|    |                                                          |
|    |----------(user types / data resumes)--------------------+|
|    |                                                          |
|    \----------(silence > 5s after completed)-----------------+|
|                                                               |
|   Any state --(pty exit)--> removed from tracking            |
+--------------------------------------------------------------+
```

Key behaviors:
- **Silence timer**: After the last `needsInput` pattern match, wait 500ms of silence (no more data) before confirming the status. This prevents false positives from partial output.
- **Working is the default**: Any data flowing = working. The detector only transitions to `needs-input` or `completed` when specific patterns match AND output goes silent.
- **User input resets**: When the user types into a `needs-input` terminal, status resets to `working`.

### Two-Phase Parsing

The detector processes PTY data in two phases:

**Phase 1 -- OSC extraction (before stripping):** Parse raw PTY data for OSC sequences. These are the highest-confidence signals and must be extracted before ANSI stripping removes them.

```typescript
// Extract OSC sequences from raw PTY data
const OSC_TITLE_RE = /\x1b\]0;([^\x07]*)\x07/g       // terminal title
const OSC_NOTIFY_RE = /\x1b\](9|99|777);([^\x07]*)\x07/g  // desktop notifications

function extractOscSignals(raw: string): {
  title?: string          // terminal title content
  notifications: string[] // notification payloads
} {
  const titleMatch = OSC_TITLE_RE.exec(raw)
  const notifications: string[] = []
  let m: RegExpExecArray | null
  while ((m = OSC_NOTIFY_RE.exec(raw)) !== null) {
    notifications.push(m[2])
  }
  return { title: titleMatch?.[1], notifications }
}
```

**Phase 2 -- Text pattern matching (after stripping):** Strip ANSI sequences from what remains and match against secondary patterns (input box chars, spinner text).

```typescript
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')   // CSI sequences (colors, cursor)
            .replace(/\x1b\][^\x07]*\x07/g, '')       // OSC sequences
            .replace(/\x1b[()][AB012]/g, '')            // charset sequences
}
```

### Buffered Analysis

PTY `onData` fires frequently with partial chunks. A naive regex match on each chunk may produce false positives (a pattern split across two chunks) or false negatives (partial match). The detector buffers the last 2KB of ANSI-stripped text per terminal and matches against the buffer:

```typescript
class ClaudeCodeDetector {
  private buffers = new Map<string, string>()      // rolling buffer per terminal (last 2KB)
  private states = new Map<string, ClaudeCodeStatus>()
  private silenceTimers = new Map<string, NodeJS.Timeout>()
  private lastDataTime = new Map<string, number>()

  private brailleSpinnerChars = new Set('\u280B\u2819\u2839\u2838\u283C\u2834\u2826\u2827\u2847\u280F')

  feed(terminalId: string, rawData: string): void {
    // Phase 1: Extract OSC sequences from raw data (highest confidence)
    const osc = extractOscSignals(rawData)

    if (osc.title !== undefined) {
      // Check if title contains Braille spinner -> working
      const hasSpinner = [...osc.title].some(ch => this.brailleSpinnerChars.has(ch))
      if (hasSpinner) {
        this.transition(terminalId, 'working')
      }
      // Title without spinner after previously having one -> task finished
      else if (this.states.get(terminalId) === 'working') {
        // Don't transition yet -- wait for OSC notification or silence
      }
    }

    if (osc.notifications.length > 0) {
      // OSC 9/99/777 = task completed notification
      this.transition(terminalId, 'completed')
      return
    }

    // Phase 2: Strip ANSI and buffer for secondary pattern matching
    const text = stripAnsi(rawData)
    const existing = this.buffers.get(terminalId) ?? ''
    this.buffers.set(terminalId, (existing + text).slice(-2048))

    this.lastDataTime.set(terminalId, Date.now())
    this.resetSilenceTimer(terminalId)

    // If currently needs-input or completed, user typing resets to working
    const currentState = this.states.get(terminalId)
    if (currentState === 'needs-input' || currentState === 'completed' || currentState === 'idle') {
      if (text.length > 0) this.transition(terminalId, 'working')
    }
  }

  private resetSilenceTimer(terminalId: string): void {
    clearTimeout(this.silenceTimers.get(terminalId))
    this.silenceTimers.set(terminalId, setTimeout(() => {
      this.analyzeBuffer(terminalId)
    }, 500))
  }

  private analyzeBuffer(terminalId: string): void {
    const buffer = this.buffers.get(terminalId) ?? ''
    // Secondary: check for input box border chars -> idle/needs-input
    const hasInputBox = /[\u256D\u256E\u2570\u256F]/.test(buffer)
    if (hasInputBox && this.states.get(terminalId) === 'working') {
      this.transition(terminalId, 'needs-input')
    }
  }
}
```

### Important Caveats

1. **Full-screen Ink rendering**: Claude Code uses React + Ink (terminal React renderer) with Yoga for Flexbox layout. It performs full-screen redraws with cursor movement sequences (`\x1B[H`, `\x1B[2J`). You cannot rely on simple line-by-line text parsing — the ANSI-stripped text in the buffer may contain redrawn fragments.

2. **Configurable spinners**: The thinking spinner verbs (e.g., "Thinking", "Analyzing") are user-configurable via `~/.claude/settings.json` -> `spinnerVerbs`. Don't rely solely on verb text — use the Braille spinner in the OSC title instead.

3. **OSC sequences and xterm.js**: xterm.js processes OSC sequences and may consume them. Since we intercept at the PTY level (main process), we see them before xterm. However, be aware that xterm will also try to set its own title from OSC 0 — the renderer should override it with our status-prefixed title.

4. **`idle_prompt` hook fires late**: Claude Code's built-in `idle_prompt` notification hook only fires after 60 seconds of idle time. Too slow for our needs — OSC-based detection is nearly instant.

### User-Input Detection (Write Interception)

To detect when the user types into a Claude Code terminal (which should reset `needs-input` -> `working`), the detector also watches `pty:write` events for tracked terminals. When data is written to a `needs-input` terminal, it transitions back to `working`.

### Dynamic Title Updates

When Claude Code status changes, the terminal title is updated automatically:

```
Status          Title Format                      Example
-------------   --------------------------        -----------------------------
idle            * Terminal Name                   * API Claude
working         + Terminal Name                   + API Claude
needs-input     ? Terminal Name                   ? API Claude
completed       v Terminal Name                   v API Claude
not-tracked     (no prefix, normal title)         Shell /api
```

The status icon is prepended to the terminal's `title` in the store. The original title is preserved separately so the icon can be swapped without losing the name.

### IPC for Status Updates

| Channel | Direction | Pattern | Purpose |
|---------|-----------|---------|---------|
| `claude:register` | renderer->main | `send/on` | Mark terminal as Claude Code session |
| `claude:unregister` | renderer->main | `send/on` | Stop tracking a terminal |
| `claude:status` | main->renderer | `webContents.send` | Push status change (id, status, contextTitle) |

The renderer registers terminals for tracking after PTY creation. The main process pushes status changes back.

---

## Windows Notification System

### Architecture

Notifications are managed by a `NotificationManager` class in the main process. It uses **Electron's built-in `Notification` API**, which maps to Windows toast notifications.

We use the main process `Notification` class (not the renderer Web Notification API) because:
1. The renderer's `setPermissionRequestHandler` currently denies all permissions — would need a carve-out
2. The main process already has PTY data and can trigger notifications without IPC round-trips
3. `notification.on('click')` runs in main process with direct `BrowserWindow` access

```typescript
// src/main/notification-manager.ts
import { Notification, BrowserWindow, app } from 'electron'

class NotificationManager {
  private window: BrowserWindow | null = null
  private activeTerminalId: string | null = null  // synced from renderer
  private activeNotifications = new Map<string, Notification>()  // prevent duplicates

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  // Called by renderer to inform which terminal is currently focused
  setActiveTerminal(id: string | null): void {
    this.activeTerminalId = id
  }

  notify(terminalId: string, status: ClaudeCodeStatus, terminalTitle: string, contextInfo?: string): void {
    // Suppress if window is TRULY focused AND this terminal is already active
    // NOTE: BrowserWindow.isFocused() has a Windows bug where it returns true
    // even when minimized (electron/electron#20464). Must combine with !isMinimized().
    const isTrulyFocused = this.window?.isFocused() && !this.window?.isMinimized()
    if (isTrulyFocused && this.activeTerminalId === terminalId) {
      return
    }

    // Only notify for actionable statuses
    if (status !== 'needs-input' && status !== 'completed') {
      return
    }

    // Close existing notification for same terminal (prevents stacking duplicates)
    const existing = this.activeNotifications.get(terminalId)
    if (existing) existing.close()

    const title = status === 'needs-input'
      ? 'Claude needs your input'
      : 'Claude completed'

    const body = contextInfo
      ? `${terminalTitle} -- ${contextInfo}`
      : terminalTitle

    const notification = new Notification({
      title,
      body,
      silent: false,         // play default Windows notification sound
      urgency: status === 'needs-input' ? 'critical' : 'normal',
    })

    notification.on('click', () => {
      // Three-step focus sequence handles all window states:
      // minimized, hidden behind other windows, or visible but unfocused.
      // restore() alone doesn't give focus; show() alone doesn't unminimize;
      // focus() alone on Windows can just flash the taskbar icon.
      // See: electron/electron#12730
      if (this.window) {
        if (this.window.isMinimized()) this.window.restore()
        this.window.show()
        this.window.focus()
      }
      // Tell renderer to focus this specific terminal
      this.window?.webContents.send('notification:focus-terminal', terminalId)
      this.activeNotifications.delete(terminalId)
    })

    notification.on('close', () => {
      this.activeNotifications.delete(terminalId)
    })

    notification.show()
    this.activeNotifications.set(terminalId, notification)
  }

  destroy(): void {
    for (const n of this.activeNotifications.values()) n.close()
    this.activeNotifications.clear()
  }
}
```

### Windows-Specific Considerations

**AppUserModelId** — Windows toast notifications **silently fail** in dev mode without an AppUserModelId. Must call this before showing any notification:

```typescript
app.setAppUserModelId('com.terminal-manager.app')
```

In production builds with electron-builder, this is handled automatically.

**`isFocused()` bug** — `BrowserWindow.isFocused()` returns `true` even when the window is minimized on Windows ([electron/electron#20464](https://github.com/electron/electron/issues/20464)). Always combine with `!isMinimized()` for correct suppression.

**Three-step focus sequence** — Bringing a window to the foreground requires `restore()` -> `show()` -> `focus()`:
- `restore()` alone doesn't give focus
- `show()` alone doesn't unminimize
- `focus()` alone on Windows can just flash the taskbar icon without actually foregrounding
- See [electron/electron#12730](https://github.com/electron/electron/issues/12730)

**Focus stealing protection** — Windows protects against foreground window theft. This works because clicking a notification grants foreground activation permission to the originating app.

**Action Center** — Dismissed notifications may linger in Windows Action Center. Calling `notification.close()` in click/destroy handlers cleans them up.

### Notification Suppression Rules

1. **Window focused + terminal active**: Don't notify — the user is already looking at it (using `isFocused() && !isMinimized()` for correct Windows behavior)
2. **Debounce**: Don't send more than one notification per terminal within 3 seconds (prevents spam during rapid state changes)
3. **Status filter**: Only notify for `needs-input` and `completed` — not for `working` or `idle`
4. **Window focused + different terminal**: DO notify — the user is in the app but looking at a different terminal
5. **Duplicate replacement**: If a terminal triggers a new notification while one is still showing, close the old one first (Map<terminalId, Notification>)

### Click-to-Focus Flow

```
User clicks notification
  -> Electron fires notification.on('click')
  -> Main process: window.restore() + window.show() + window.focus()
  -> Main process: webContents.send('notification:focus-terminal', terminalId)
  -> Renderer: receives terminalId
  -> Renderer: finds which group contains this terminal
  -> Renderer: calls setActiveGroup(groupId) + setActiveTerminal(terminalId)
  -> Terminal pane is now visible and focused
```

### IPC Channels for Notifications

| Channel | Direction | Pattern | Purpose |
|---------|-----------|---------|---------|
| `notification:focus-terminal` | main->renderer | `webContents.send` | Notification clicked — focus this terminal |
| `notification:active-terminal` | renderer->main | `send/on` | Inform main which terminal is active (for suppression) |

The renderer **pushes** `activeTerminalId` to main on every change (fire-and-forget via `send`). This keeps the suppression check synchronous in the main process — no need for async `invoke` round-trips. Terminal switches are infrequent, so the overhead is negligible.

### Notification Content

| Status | Title | Body |
|--------|-------|------|
| `needs-input` | "Claude needs your input" | "{Terminal Title} -- {context}" |
| `completed` | "Claude completed" | "{Terminal Title}" |

Context examples:
- "API Claude -- Allow Read tool?"
- "Worker Claude -- Waiting for your response"
- "API Claude" (no specific context detected)

---

## Visual Design — Status Indicators

### Status Icons & Colors

All icons are Unicode characters that render well at 14px in the title bar.

| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| `idle` | `*` (U+25CF) | `#6e7681` (dim gray) | At prompt, not doing anything |
| `working` | `+` (U+25C6) | `#58a6ff` (blue) | Actively processing |
| `needs-input` | `?` (U+25C8) | `#d29922` (amber) | Waiting for user — **action required** |
| `completed` | `v` (U+2713) | `#3fb950` (green) | Task finished |
| `not-tracked` | (none) | -- | Regular terminal, no status shown |

### Title Bar Treatment

The status icon appears at the start of the terminal title in the `TerminalPane` title bar:

```
+------------------------------------------+
| ? API Claude                    [|] [-] x |  <- amber icon = needs input
+------------------------------------------+
| $ claude                                  |
| I need to read the file. Allow Read?      |
| (y/n) _                                   |
+------------------------------------------+
```

For `needs-input`, the icon **pulses** with a CSS animation:

```css
@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.claude-status-icon.needs-input {
  color: #d29922;
  animation: status-pulse 1.5s ease-in-out infinite;
}

.claude-status-icon.working {
  color: #58a6ff;
}

.claude-status-icon.idle {
  color: #6e7681;
}

.claude-status-icon.completed {
  color: #3fb950;
}
```

### Group Tab Attention Badge

When ANY terminal in a group has `needs-input` status, the group tab shows an attention indicator:

```
[? CC Multi-Repo Claude] [FE Frontend] [+] [v]
 ^ pulsing amber dot      ^ no attention
```

The attention badge is a small colored dot next to the group icon/label:

```css
.terminal-tab-attention {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d29922;
  animation: status-pulse 1.5s ease-in-out infinite;
  margin-left: 4px;
  flex-shrink: 0;
}
```

If the group has `completed` terminals but no `needs-input`, show a green dot (no pulse):

```css
.terminal-tab-attention.completed {
  background: #3fb950;
  animation: none;
}
```

### Title Bar Background Tinting by Status

For Claude Code terminals, the title bar gets a subtle status-colored tint on top of the group color:

```css
.terminal-pane.claude-needs-input .terminal-title-bar {
  background: linear-gradient(90deg, rgba(210, 153, 34, 0.15), transparent 60%);
}

.terminal-pane.claude-completed .terminal-title-bar {
  background: linear-gradient(90deg, rgba(63, 185, 80, 0.10), transparent 60%);
}
```

---

## Claude Code Detection Patterns (Optional Override)

Users can customize detection patterns via a config file:

```
Windows: %APPDATA%/terminal-manager/claude-patterns.json
```

If not present, defaults are used. This is an advanced feature — most users won't need to touch it.

---

## Implementation Plan

### Step 1: Types

1. Add `ClaudeCodeStatus` type to `src/renderer/store/template-types.ts`
2. Extend `TerminalInfo` with `claudeCode`, `claudeStatus`, `claudeStatusTitle`
3. Add Claude Code and notification IPC channels to `src/shared/ipc-types.ts`

### Step 2: Claude Code Detector (Main Process)

1. Create `src/main/claude-detector.ts` — `ClaudeCodeDetector` class
2. Implement two-phase parsing: OSC extraction + ANSI stripping
3. Implement rolling buffer (2KB per terminal), silence timers
4. Implement state machine with configurable patterns
5. Wire into `PtyManager.onData` pipeline — `detector.feed()` called on every data event
6. Also intercept `pty:write` to detect user input (resets `needs-input` -> `working`)
7. Emit `claude:status` events to renderer via `webContents.send`

### Step 3: Notification Manager (Main Process)

1. Create `src/main/notification-manager.ts` — `NotificationManager` class
2. Set `app.setAppUserModelId('com.terminal-manager.app')` in main entry
3. Implement notification suppression (window focus + active terminal check, debounce)
4. Handle notification click -> `window.restore/show/focus` + `notification:focus-terminal` IPC
5. Wire to `ClaudeCodeDetector` status change events

### Step 4: IPC & Preload Updates

1. Add Claude Code IPC channels to `src/shared/ipc-types.ts`
2. Add notification IPC channels
3. Update `src/preload/index.ts` with new API surface
4. Register all new handlers in `src/main/ipc-handlers.ts`

### Step 5: Store — Claude Code Status

1. Add `setClaudeStatus(id, status, contextTitle?)` action to store
2. Add store listener for `claude:status` IPC events (in pty-dispatcher or a new dispatcher)
3. Add store listener for `notification:focus-terminal` events -> `setActiveGroup` + `setActiveTerminal`
4. When `setActiveTerminal` changes, send `notification:active-terminal` to main (for suppression)

### Step 6: Status Icons in Terminal Pane

1. Update `TerminalPane.tsx` — render status icon before title, add status-based CSS classes
2. Add pulse animation for `needs-input`
3. Add status-based title bar tinting

### Step 7: Group Tab Attention Badge

1. Update `TerminalTabs.tsx` — derive attention status from group's terminals
2. Render pulsing amber dot for `needs-input`, static green dot for `completed`

### Step 8: Tests

1. **ANSI stripping + OSC extraction** — pure functions, unit testable
2. **Claude Code detector state machine** — feed sequences of data, assert status transitions
3. **Notification suppression logic** — window focus + terminal active scenarios
4. **Store actions** — `setClaudeStatus`, notification focus routing
5. **Component tests** — status icon rendering, attention badge, pulse animation classes

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/main/claude-detector.ts` | PTY output parser, state machine, OSC extraction, ANSI stripping |
| `src/main/notification-manager.ts` | Windows toast notifications, click-to-focus, suppression |
| `src/renderer/lib/claude-status-dispatcher.ts` | Listen for `claude:status` IPC, update store |
| `src/renderer/assets/styles/claude-status.css` | Status icons, pulse animation, attention badge |
| `src/main/__tests__/claude-detector.test.ts` | Detector state machine + OSC/ANSI parsing tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/shared/ipc-types.ts` | Add Claude and notification IPC channel constants |
| `src/renderer/store/types.ts` | Add `claudeCode`, `claudeStatus`, `claudeStatusTitle` to `TerminalInfo`; add new store actions |
| `src/renderer/store/terminal-store.ts` | Add `setClaudeStatus()` action |
| `src/main/index.ts` | Instantiate `ClaudeCodeDetector` + `NotificationManager`, set AppUserModelId |
| `src/main/pty-manager.ts` | Feed data to `ClaudeCodeDetector`, intercept writes for tracked terminals |
| `src/main/ipc-handlers.ts` | Register Claude and notification IPC handlers |
| `src/preload/index.ts` | Add Claude status and notification IPC bridge methods |
| `src/preload/index.d.ts` | Type declarations for new IPC methods |
| `src/renderer/components/Terminal/TerminalTabs.tsx` | Attention badge rendering |
| `src/renderer/components/Terminal/TerminalPane.tsx` | Status icon before title, status-based CSS classes |
| `src/renderer/lib/pty-dispatcher.ts` | Add listener for `claude:status` and `notification:focus-terminal` events |
| `src/renderer/assets/styles/tabs.css` | Attention badge styles |
| `src/renderer/assets/styles/splitpane.css` | Status icon placement, title bar tinting |

---

## Scope Boundaries

**In scope:**
- Claude Code status detection (OSC parsing, state machine, two-phase analysis)
- Dynamic terminal title with status icons
- Windows toast notifications on status changes
- Click-to-focus from notification
- Notification suppression when already focused
- Group tab attention badges
- Configurable detection patterns (advanced users)

**Out of scope (future):**
- System tray icon with notification count
- Sound customization for notifications
- Claude Code auto-detection (detecting `claude` command without explicit marking)
- Claude Code hooks integration (watching status files from Notification hooks)
- Per-terminal notification preferences (mute specific terminals)
- Notification history / log

**Related:** [Layout Templates PRD](./prd-layout-templates.md) — template storage, group visuals, startup commands, `claudeCode: true` slot marking
