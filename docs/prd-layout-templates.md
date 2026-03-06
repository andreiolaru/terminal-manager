# Layout Templates — PRD

## Overview

Layout templates let you launch a pre-configured terminal group in one click — a named split layout where each pane has a title, working directory, and startup command. Groups get visual identity through an icon, accent color, and a subtle dark background gradient.

**Example**: A "Backend Dev" template opens a 3x2 grid — top row has API server, database watcher, and log tailer; bottom row has three shells at different repo directories. The group tab shows a server icon in teal, and the pane backgrounds carry a faint teal-to-black gradient.

Template slots can optionally mark terminals as Claude Code sessions (`claudeCode: true`) — see [prd-claude-code-integration.md](./prd-claude-code-integration.md) for status tracking, notifications, and visual indicators.

---

## Data Model

### Template Definition

Templates are stored as a JSON array in a user config file (`%APPDATA%/terminal-manager/templates.json`). Each template describes a layout tree and group appearance.

```typescript
interface TerminalSlot {
  title: string
  cwd?: string                // absolute path; defaults to user home
  shell?: string              // override DEFAULT_SHELL (e.g., "bash.exe", "cmd.exe")
  startupCommand?: string     // run after shell is ready (e.g., "claude", "npm run dev")
  claudeCode?: boolean        // mark for status tracking (see Claude Code Integration PRD)
}

interface LayoutLeaf {
  type: 'leaf'
  terminal: TerminalSlot
}

interface LayoutBranch {
  type: 'branch'
  direction: 'horizontal' | 'vertical'
  ratio: number              // 0-1, proportion for `first` pane
  first: LayoutNode
  second: LayoutNode
}

type LayoutNode = LayoutLeaf | LayoutBranch

interface LayoutTemplate {
  id: string                  // uuid, generated on creation
  name: string                // e.g., "Backend Dev"
  icon?: string               // emoji or short text (e.g., "BE", "CC")
  color?: string              // hex accent color for tab + title bars (e.g., "#2d8a6e")
  backgroundGradient?: {
    from: string              // dark color, close to black (e.g., "#0a1a14")
    to: string                // dark color, close to black (e.g., "#0d0d0d")
    angle?: number            // CSS gradient angle in degrees (default: 135)
  }
  layout: LayoutNode
}
```

### Group Appearance Extensions

The `TerminalGroup` type gains optional visual properties:

```typescript
interface TerminalGroup {
  id: string
  label: string
  splitTree: SplitNode
  activeTerminalId: TerminalId

  // Visual identity (set when created from a template, editable after)
  icon?: string
  color?: string
  backgroundGradient?: {
    from: string
    to: string
    angle?: number
  }
}
```

These are copied from the template at instantiation time, then owned by the group.

### 3x2 Grid Example

```
+----------+----------+----------+
|  API     |  Worker  |  Logs    |
|  Server  |  Process |  Tailer  |
+----------+----------+----------+
|  Shell   |  Shell   |  Shell   |
|  /api    |  /worker |  /infra  |
+----------+----------+----------+
```

---

## Storage

### Template File Location

Templates live in user data, not in the app bundle:

```
Windows: %APPDATA%/terminal-manager/templates.json
```

The main process reads/writes this file. A default empty array `[]` is created on first launch if the file doesn't exist.

### IPC Channels

| Channel | Pattern | Purpose |
|---------|---------|---------|
| `templates:list` | `invoke/handle` | Return all templates |
| `templates:save` | `invoke/handle` | Save full template array (create/update/delete) |
| `templates:get-path` | `invoke/handle` | Return the file path (for "Open in editor") |

The renderer gets the full list, makes edits in-memory, and sends the updated array back. No incremental CRUD — the template list is small enough to overwrite atomically.

---

## Startup Command Execution

When a group is instantiated from a template, each terminal's `startupCommand` is written to the PTY after the shell is ready. The timing matters:

1. PTY is created via `pty:create` with the slot's `cwd` and `shell`
2. Wait for the first `pty:data` event (shell prompt is ready)
3. Write `startupCommand + '\r'` to the PTY via `pty:write`

For Claude Code terminals (`claudeCode: true`), after the startup command writes `claude\r`, the main process also calls `claudeCodeDetector.register(terminalId)` to begin status tracking.

### Store Action

```typescript
// New store action
instantiateLayout: (template: LayoutTemplate) => string  // returns groupId
```

This action:
1. Walks the `LayoutNode` tree, creating a `TerminalInfo` for each leaf (with `title`, `shell`, `cwd`, `claudeCode` from the slot)
2. Builds a corresponding `SplitNode` tree (same shape, but with generated terminal IDs instead of `TerminalSlot` objects)
3. Creates a `TerminalGroup` with the template's `name`, `icon`, `color`, and `backgroundGradient`
4. Returns startup commands to the PTY creation layer

### Startup Command Delivery

Add `startupCommand?: string` to `TerminalInfo`. The `TerminalInstance` component writes it after the first `pty:data` event, then clears it via `clearStartupCommand(id)`.

---

## UI

### Template Launcher

A dropdown button next to the "+" tab button:

```
[Group 1] [Group 2] [+] [v Templates]
                          ├─ Backend Dev      (BE)
                          ├─ Frontend Dev     (FE)
                          ├─ 2x2 Grid         (##)
                          ├─ ──────────────────────
                          └─ Manage Templates...
```

### Template Manager

"Manage Templates..." opens a modal where the user can:

- **View** all templates as cards showing name, icon, color preview, layout diagram
- **Create** a new template (form-based or "Save current layout as template")
- **Edit** a template (modify name, icon, color, gradient, terminal slots)
- **Delete** / **Duplicate** a template
- **Import/Export** (copy JSON to clipboard, or open the file in an external editor)

#### "Save Current Layout as Template"

1. User right-clicks a group tab -> "Save as Template"
2. Current split tree is walked, converting each `SplitLeaf` into a `TerminalSlot`
3. Group visual properties are copied
4. User names the template -> saved

### Group Tab Visual Changes

```
[BE Backend Dev] [FE Frontend] [+] [v]
 ^icon  ^label    ^icon  ^label
 teal accent       blue accent
```

- **Icon**: Before the label, small and monospace
- **Color**: Tab accent/border-bottom color (replaces the default `#007acc` blue)
- **Background gradient**: Applied to `.terminal-group-container`

### Title Bar Tinting

Each `TerminalPane` title bar gets a subtle tint from the group's `color`:

```css
.terminal-title-bar {
  background: var(--group-color-bg, #2d2d2d);
}
```

The tint is very subtle — mix the group color at ~10-15% opacity with the default dark background.

---

## Visual Design — Background Gradient

The background gradient is intentionally subtle. All colors should be very close to black (`#0d0d0d` to `#1a1a1a` range). The gradient serves as a visual identity cue, not a distraction.

```css
.terminal-group-container {
  background: linear-gradient(
    var(--group-gradient-angle, 135deg),
    var(--group-gradient-from, #1e1e1e),
    var(--group-gradient-to, #1e1e1e)
  );
}
```

CSS custom properties set inline via React:

```tsx
<div
  className="terminal-group-container"
  style={{
    display: group.id === activeGroupId ? 'flex' : 'none',
    '--group-gradient-from': group.backgroundGradient?.from ?? '#1e1e1e',
    '--group-gradient-to': group.backgroundGradient?.to ?? '#1e1e1e',
    '--group-gradient-angle': `${group.backgroundGradient?.angle ?? 135}deg`,
    '--group-color': group.color ?? '#007acc',
    '--group-color-bg': group.color ? mixColor(group.color, '#2d2d2d', 0.12) : '#2d2d2d',
  } as React.CSSProperties}
>
```

The gradient is visible in pane title bars (via `--group-color-bg`), split divider/sash gaps, and the outer container. The xterm terminal area itself remains solid black.

---

## Implementation Plan

### Step 1: Types & Config

1. Add `LayoutTemplate`, `LayoutNode`, `LayoutLeaf`, `LayoutBranch`, `TerminalSlot` types to `src/renderer/store/template-types.ts`
2. Extend `TerminalGroup` with optional `icon`, `color`, `backgroundGradient`
3. Extend `TerminalInfo` with `startupCommand`, `claudeCode`
4. Add template IPC channels to `src/shared/ipc-types.ts`

### Step 2: Template Storage (Main Process)

1. Create `src/main/template-manager.ts` — reads/writes `templates.json`
2. Register IPC handlers for `templates:list`, `templates:save`, `templates:get-path`
3. Create default empty file on first launch

### Step 3: Template Instantiation (Store)

1. Add `instantiateLayout(template: LayoutTemplate): string` to the store
2. Implement tree walker: `LayoutNode` -> `SplitNode` + `TerminalInfo` entries
3. Create group with visual properties
4. Add `clearStartupCommand(id)` action

### Step 4: Startup Command Execution

1. In `TerminalInstance`, after first `pty:data`, write `startupCommand + '\r'` and clear it
2. After startup command for Claude Code terminals, send `claude:register` to main process

### Step 5: Group Visual Properties (CSS)

1. Update `TerminalPanel.tsx` — CSS custom properties on group containers
2. Update `tabs.css` — tab icon rendering, per-group accent color
3. Update `splitpane.css` — title bar tinting via `--group-color-bg`
4. Add `src/renderer/lib/color-utils.ts` — `mixColor()` helper
5. Update `TerminalTabs.tsx` — render icon and color

### Step 6: Template Launcher UI

1. Add template dropdown button next to "+" in tab bar
2. Fetch templates from main process on dropdown open
3. Click template -> `instantiateLayout()`
4. "Manage Templates..." link

### Step 7: Template Manager

1. Build template list/card view modal
2. Create/edit form: name, icon, color picker, gradient pickers, terminal slot editor
3. "Save current layout as template" on group tab context menu
4. Delete / duplicate actions

### Step 8: Tests

1. Template tree walker (`LayoutNode` -> `SplitNode` conversion) — pure function, unit testable
2. Template file read/write (main process)
3. `instantiateLayout` store action
4. Startup command delivery
5. Visual property rendering (CSS custom properties applied correctly)

---

## Example Templates JSON

```json
[
  {
    "id": "tpl-multi-claude",
    "name": "Multi-Repo Claude",
    "icon": "CC",
    "color": "#8b5cf6",
    "backgroundGradient": { "from": "#0f0a1a", "to": "#0d0d0d", "angle": 135 },
    "layout": {
      "type": "branch",
      "direction": "horizontal",
      "ratio": 0.333,
      "first": {
        "type": "branch",
        "direction": "vertical",
        "ratio": 0.5,
        "first": { "type": "leaf", "terminal": { "title": "API Claude", "cwd": "C:/projects/api", "startupCommand": "claude", "claudeCode": true } },
        "second": { "type": "leaf", "terminal": { "title": "Shell /api", "cwd": "C:/projects/api" } }
      },
      "second": {
        "type": "branch",
        "direction": "horizontal",
        "ratio": 0.5,
        "first": {
          "type": "branch",
          "direction": "vertical",
          "ratio": 0.5,
          "first": { "type": "leaf", "terminal": { "title": "Worker Claude", "cwd": "C:/projects/worker", "startupCommand": "claude", "claudeCode": true } },
          "second": { "type": "leaf", "terminal": { "title": "Shell /worker", "cwd": "C:/projects/worker" } }
        },
        "second": {
          "type": "branch",
          "direction": "vertical",
          "ratio": 0.5,
          "first": { "type": "leaf", "terminal": { "title": "Infra Claude", "cwd": "C:/projects/infra", "startupCommand": "claude", "claudeCode": true } },
          "second": { "type": "leaf", "terminal": { "title": "Shell /infra", "cwd": "C:/projects/infra" } }
        }
      }
    }
  },
  {
    "id": "tpl-backend",
    "name": "Backend Dev",
    "icon": "BE",
    "color": "#2d8a6e",
    "backgroundGradient": { "from": "#0a1a14", "to": "#0d0d0d", "angle": 135 },
    "layout": {
      "type": "branch",
      "direction": "horizontal",
      "ratio": 0.5,
      "first": { "type": "leaf", "terminal": { "title": "API Server", "cwd": "C:/projects/api", "startupCommand": "npm run dev" } },
      "second": {
        "type": "branch",
        "direction": "vertical",
        "ratio": 0.5,
        "first": { "type": "leaf", "terminal": { "title": "Claude Dev", "cwd": "C:/projects/api", "startupCommand": "claude", "claudeCode": true } },
        "second": { "type": "leaf", "terminal": { "title": "Shell", "cwd": "C:/projects/api" } }
      }
    }
  },
  {
    "id": "tpl-2x2-grid",
    "name": "2x2 Grid",
    "icon": "##",
    "color": "#8a6e2d",
    "layout": {
      "type": "branch",
      "direction": "horizontal",
      "ratio": 0.5,
      "first": {
        "type": "branch",
        "direction": "vertical",
        "ratio": 0.5,
        "first": { "type": "leaf", "terminal": { "title": "Top Left" } },
        "second": { "type": "leaf", "terminal": { "title": "Bottom Left" } }
      },
      "second": {
        "type": "branch",
        "direction": "vertical",
        "ratio": 0.5,
        "first": { "type": "leaf", "terminal": { "title": "Top Right" } },
        "second": { "type": "leaf", "terminal": { "title": "Bottom Right" } }
      }
    }
  }
]
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/store/template-types.ts` | `LayoutTemplate`, `LayoutNode`, `TerminalSlot` types |
| `src/main/template-manager.ts` | Read/write templates.json from app data dir |
| `src/renderer/lib/template-utils.ts` | Convert `LayoutNode` to `SplitNode` + `TerminalInfo` entries |
| `src/renderer/lib/color-utils.ts` | `mixColor()` for subtle tinting |
| `src/renderer/components/Templates/TemplateLauncher.tsx` | Dropdown menu next to "+" tab button |
| `src/renderer/components/Templates/TemplateManager.tsx` | Full template CRUD modal/panel |
| `src/renderer/assets/styles/templates.css` | Template launcher + manager styles |
| `src/renderer/lib/__tests__/template-utils.test.ts` | Template tree conversion tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/shared/ipc-types.ts` | Add template IPC channel constants |
| `src/renderer/store/types.ts` | Add `icon`, `color`, `backgroundGradient` to `TerminalGroup`; add `startupCommand`, `claudeCode` to `TerminalInfo` |
| `src/renderer/store/terminal-store.ts` | Add `instantiateLayout()`, `clearStartupCommand()` actions |
| `src/main/ipc-handlers.ts` | Register template IPC handlers |
| `src/preload/index.ts` | Add template IPC bridge methods |
| `src/preload/index.d.ts` | Type declarations for template IPC |
| `src/renderer/components/Terminal/TerminalTabs.tsx` | Render group icon + color, add template launcher button |
| `src/renderer/components/Terminal/TerminalPanel.tsx` | Pass CSS custom properties for gradient/color to group containers |
| `src/renderer/components/Terminal/TerminalInstance.tsx` | Execute startup command after first `pty:data` |
| `src/renderer/assets/styles/tabs.css` | Tab icon, per-group accent color via CSS vars |
| `src/renderer/assets/styles/splitpane.css` | Title bar tinting via `--group-color-bg` |
| `src/renderer/assets/styles/terminal.css` | Group container gradient background |

---

## Scope Boundaries

**In scope:**
- Template storage, loading, instantiation
- Group visual properties (icon, color, gradient)
- Startup command execution
- Template launcher dropdown
- "Save current layout as template"
- Basic template management (create, edit, delete)

**Out of scope (future):**
- Template sharing/import from URL
- Template marketplace
- Per-terminal color/theme overrides (beyond group-level gradient)
- Template variables/placeholders (e.g., `${projectDir}`)
- Auto-launch templates on app start
- Template keyboard shortcuts

**Related:** [Claude Code Integration PRD](./prd-claude-code-integration.md) — status detection, notifications, status icons
