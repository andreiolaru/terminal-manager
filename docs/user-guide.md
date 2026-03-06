# Terminal Manager - User Guide

A VS Code-style integrated terminal manager for Windows. Run multiple shells in split panes, organize them into groups, and save layouts as reusable templates.

---

## Getting Started

```bash
npm install
npm run dev
```

The app launches with one terminal group containing a single PowerShell terminal. You're ready to go.

---

## Interface Overview

```
+---------------------------------------------------------------+
| Menu Bar (hidden — press Alt to reveal)                       |
+----------+---+---+---+---+---+---+---+--------+--+--+        |
| TERMINALS| Group 1 | Group 2 |   +   |        | v|  |        |
+----------+---+---+---+---+---+---+---+--------+--+--+        |
|          |  Terminal Title Bar    [Split] [Split] [X]|        |
| Sidebar  |                                           |        |
| (terminal|          Terminal Pane                     |        |
|  list)   |                                           |        |
|          |                                           |        |
|  [+] [G] |                                           |        |
+----------+-------------------------------------------+        |
+---------------------------------------------------------------+
```

- **Sidebar** (left): Lists terminals in the active group. Two buttons at top: **+** (new terminal) and **G** (new group).
- **Tab Bar** (top of terminal area): One tab per group. **+** button to add a group. **v** dropdown for layout templates.
- **Terminal Pane** (center): The active terminal. Title bar shows the terminal name and action buttons on hover.
- **Menu Bar**: Hidden by default. Press **Alt** to show it.

---

## Terminals

### Create a Terminal

- Click **+** in the sidebar, or
- Press **Ctrl+Shift+T**, or
- Use **File > New Terminal** from the menu bar

A new terminal opens in the active group.

### Rename a Terminal

**Double-click** the terminal name in the sidebar. Type a new name, then press **Enter** to save or **Escape** to cancel.

### Close a Terminal

- Hover over a terminal in the sidebar and click the **x** button, or
- Press **Ctrl+Shift+W** to close the active terminal, or
- Click the **x** button in the terminal's title bar (visible on hover)

### Terminal Behavior

- Terminals use PowerShell by default.
- Scrollback is preserved at 5000 lines per terminal.
- If a terminal's process exits, the pane shows `[Process exited with code X]` and the title fades. You can still scroll the history.
- Hidden terminals (in inactive groups) keep their state — switching back reveals them exactly as you left them.

---

## Groups

Groups are independent workspaces. Each group has its own set of terminals and split layout. Think of them as VS Code's terminal tabs.

### Create a Group

- Click **G** in the sidebar, or
- Click **+** in the tab bar

A new group is created with one terminal and becomes active immediately.

### Switch Between Groups

- Click a **group tab** in the tab bar, or
- Press **Ctrl+Tab** to cycle forward, or
- Press **Ctrl+Shift+Tab** to cycle backward

### Rename a Group

**Double-click** the group tab. Type a new name, then press **Enter** to save or **Escape** to cancel.

### Close a Group

Click the **x** button on the group tab (visible on hover or when the tab is active). This closes all terminals in the group.

If you close the last group, a new empty one is automatically created.

---

## Split Panes

Split any terminal pane into two. Splits can be nested — split a split, as many levels deep as you need.

### Create a Split

Hover over a terminal pane to reveal title bar buttons:

- **Split Right** button — splits the pane horizontally (new terminal appears to the right)
- **Split Down** button — splits the pane vertically (new terminal appears below)

Or use keyboard shortcuts:

- **Ctrl+Shift+D** — split right
- **Ctrl+Shift+E** — split down

### Navigate Between Panes

- **Alt+Left** — focus the pane to the left
- **Alt+Right** — focus the pane to the right
- **Alt+Up** — focus the pane above
- **Alt+Down** — focus the pane below

The active pane has a blue left border on its title bar.

### Resize Panes

Drag the divider between panes to resize them. Panes have a minimum size of 50px to prevent them from disappearing.

### Close a Pane

Click the **x** button in the pane's title bar, or press **Ctrl+Shift+W** while the pane is focused.

---

## Layout Templates

Save your current group layout (splits, terminal names, working directories) as a template to recreate it later.

### Save a Template

1. Set up your group with the splits and terminals you want.
2. Click the **v** dropdown button in the tab bar (right side).
3. Click **Manage Templates...** at the bottom of the dropdown.
4. Click **Save current layout as template**.

### Launch a Template

1. Click the **v** dropdown button in the tab bar.
2. Select a template from the list.

A new group is created with the saved layout.

### Manage Templates

In the template manager dialog (**v** > **Manage Templates...**):

- **Edit** a template's name, icon, or color with the pencil button.
- **Duplicate** a template with the copy button.
- **Delete** a template with the x button.

Templates are stored in `~/.terminal-manager/templates.json`.

---

## Keyboard Shortcuts

### Terminal Management

| Action | Shortcut |
|---|---|
| New Terminal | Ctrl+Shift+T |
| Close Terminal | Ctrl+Shift+W |

### Split Panes

| Action | Shortcut |
|---|---|
| Split Right | Ctrl+Shift+D |
| Split Down | Ctrl+Shift+E |

### Group Navigation

| Action | Shortcut |
|---|---|
| Next Group | Ctrl+Tab |
| Previous Group | Ctrl+Shift+Tab |

### Pane Navigation

| Action | Shortcut |
|---|---|
| Focus Left | Alt+Left |
| Focus Right | Alt+Right |
| Focus Up | Alt+Up |
| Focus Down | Alt+Down |

### Clipboard

| Action | Shortcut |
|---|---|
| Copy | Ctrl+Shift+C |
| Paste | Ctrl+Shift+V |

### Zoom

| Action | Shortcut |
|---|---|
| Zoom In | Ctrl++ |
| Zoom Out | Ctrl+- |
| Reset Zoom | Ctrl+0 |

All shortcuts are also listed in the **Shortcuts** menu (press Alt to reveal the menu bar).

---

## Menu Bar

The menu bar is hidden by default. Press **Alt** to reveal it.

| Menu | Items |
|---|---|
| **Shortcuts** | All keyboard shortcuts listed with their key bindings |
| **File** | New Terminal, Close Terminal, Quit |
| **Edit** | Copy (Ctrl+Shift+C), Paste (Ctrl+Shift+V) |
| **View** | Split Right, Split Down, Zoom In/Out/Reset, Toggle DevTools (dev only) |
| **Help** | About Terminal Manager |

---

## Configuration

There is no settings UI yet. Defaults are defined in `src/renderer/lib/config.ts` and can be changed by editing the source:

| Setting | Default |
|---|---|
| Shell | `powershell.exe` |
| Font | Cascadia Code, Consolas, monospace |
| Font Size | 14px |
| Scrollback | 5000 lines |
| Cursor Blink | On |
| Theme | Dark (VS Code-style) |
| Window Opacity | 1.0 |

The theme uses CSS custom properties, so all UI colors (sidebar, tabs, borders, terminal background/foreground) are centrally defined and can be adjusted in the config.

---

## Claude Code Integration

Terminal Manager can detect when [Claude Code](https://docs.anthropic.com/en/docs/claude-code) is running in a terminal and show live status indicators.

### How It Works

The app monitors PTY output for signals that Claude Code emits — spinner characters in the terminal title (OSC escape sequences), input box drawing characters, and desktop notification sequences. No configuration on the Claude Code side is needed.

### Enabling Tracking

Claude Code detection is enabled **per terminal** via layout templates. When you save a template, terminals with `claudeCode: true` in the template definition will be tracked when the template is launched. Currently there is no UI toggle — it's set in the template's JSON file at `~/.terminal-manager/templates.json`.

To enable tracking for a terminal slot in a template, add `"claudeCode": true` to the terminal slot:

```json
{
  "type": "leaf",
  "terminal": {
    "title": "Claude",
    "claudeCode": true,
    "startupCommand": "claude"
  }
}
```

### Status Indicators

Tracked terminals show a status icon to the left of the terminal title in the pane title bar:

| Icon | Status | Color | Meaning |
|---|---|---|---|
| ● | Idle | Gray | Claude Code is running but not processing |
| ◆ | Working | Blue | Claude is actively processing |
| ◈ | Needs Input | Yellow (pulsing) | Claude is waiting for your input |
| ✓ | Completed | Green | Claude has finished a task |

### Title Bar Tinting

When a tracked terminal enters certain states, the pane title bar gets a subtle color tint:

- **Needs input** — yellow-orange gradient on the left edge
- **Completed** — green gradient on the left edge

This makes it easy to spot which pane needs attention at a glance, even with many splits open.

### Tab Badges

Group tabs show attention badges when any terminal in the group has a notable Claude Code status:

- **Orange pulsing dot** — a terminal in this group needs input
- **Green dot** — a terminal in this group has completed a task

"Needs input" takes priority if both states exist in the same group.

### Desktop Notifications

When the app window is not focused (or minimized), Windows toast notifications appear for:

- **"Claude needs your input"** — when Claude Code is waiting for input
- **"Claude has finished"** — when a task completes

Clicking the notification brings the window to the foreground and focuses the relevant terminal. Notifications are debounced (3 seconds) to prevent spam.

### Status Transitions

The detection follows this lifecycle:

```
idle → working → needs-input → (you type) → working → completed → idle
                                                         ↑ (5s auto-reset)
```

- **Idle → Working**: Claude's spinner appears in the terminal title
- **Working → Needs Input**: Input box characters are detected followed by 500ms of silence
- **Needs Input / Completed → Working**: You type something in the terminal
- **Working → Completed**: Claude sends an OSC notification sequence
- **Completed → Idle**: Automatic after 5 seconds
