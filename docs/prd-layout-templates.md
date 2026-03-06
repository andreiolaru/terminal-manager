# Layout Templates — PRD

## Overview

Layout templates let you launch a pre-configured terminal group in one click — a named split layout where each pane has a title, working directory, and startup command. Groups get visual identity through an icon, accent color, and a subtle dark background gradient.

**Example**: A "Backend Dev" template opens a 3x2 grid — top row has API server, database watcher, and log tailer; bottom row has three shells at different repo directories. The group tab shows a server icon in teal, and the pane backgrounds carry a faint teal-to-black gradient.

---

## Data Model

### Template Definition

Templates are stored as a JSON array in a user config file (`~/.terminal-manager/templates.json` or `%APPDATA%/terminal-manager/templates.json`). Each template describes a layout tree and group appearance.

```typescript
interface TerminalSlot {
  title: string
  cwd?: string                // absolute path; defaults to user home
  shell?: string              // override DEFAULT_SHELL (e.g., "bash.exe", "cmd.exe")
  startupCommand?: string     // run after shell is ready (e.g., "npm run dev")
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
  icon?: string               // emoji or short text (e.g., "🖥", "BE")
  color?: string              // hex accent color for tab + title bars (e.g., "#2d8a6e")
  backgroundGradient?: {
    from: string              // dark color, close to black (e.g., "#0a1a14")
    to: string                // dark color, close to black (e.g., "#0d0d0d")
    angle?: number            // CSS gradient angle in degrees (default: 135)
  }
  layout: LayoutNode
}
```

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

```json
{
  "id": "abc-123",
  "name": "Backend Dev",
  "icon": "BE",
  "color": "#2d8a6e",
  "backgroundGradient": {
    "from": "#0a1a14",
    "to": "#0d0d0d",
    "angle": 135
  },
  "layout": {
    "type": "branch",
    "direction": "horizontal",
    "ratio": 0.333,
    "first": {
      "type": "branch",
      "direction": "vertical",
      "ratio": 0.5,
      "first": { "type": "leaf", "terminal": { "title": "API Server", "cwd": "C:/projects/api", "startupCommand": "npm run dev" } },
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
        "first": { "type": "leaf", "terminal": { "title": "Worker Process", "cwd": "C:/projects/worker", "startupCommand": "npm run worker" } },
        "second": { "type": "leaf", "terminal": { "title": "Shell /worker", "cwd": "C:/projects/worker" } }
      },
      "second": {
        "type": "branch",
        "direction": "vertical",
        "ratio": 0.5,
        "first": { "type": "leaf", "terminal": { "title": "Log Tailer", "cwd": "C:/projects/infra", "startupCommand": "tail -f logs/app.log" } },
        "second": { "type": "leaf", "terminal": { "title": "Shell /infra", "cwd": "C:/projects/infra" } }
      }
    }
  }
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

  // New — visual identity (set when created from a template, editable after)
  icon?: string
  color?: string
  backgroundGradient?: {
    from: string
    to: string
    angle?: number
  }
}
```

These are copied from the template at instantiation time, then owned by the group (editing the template later doesn't affect running groups).

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

This is a one-shot fire — the command is not retried or tracked. If the shell isn't ready yet (rare edge case), a small delay (200-500ms) after `pty:create` resolves is an acceptable fallback.

### Store Action

```typescript
// New store action
instantiateTemplate: (templateId: string) => string  // returns groupId

// Or directly from a LayoutTemplate object
instantiateLayout: (template: LayoutTemplate) => string
```

This action:
1. Walks the `LayoutNode` tree, creating a `TerminalInfo` for each leaf (with `title`, `shell`, `cwd` from the slot)
2. Builds a corresponding `SplitNode` tree (same shape, but with generated terminal IDs instead of `TerminalSlot` objects)
3. Creates a `TerminalGroup` with the template's `name`, `icon`, `color`, and `backgroundGradient`
4. Stores `startupCommand` per terminal (transient — not in `TerminalInfo`, passed to the PTY hook)

### Startup Command Delivery

Option A — **Store a pending command map**: The store action returns a `Map<TerminalId, string>` of startup commands. The component that creates PTYs (`usePtyIpc` or `TerminalInstance`) checks this map after PTY creation and writes the command.

Option B — **Extend `TerminalInfo` with `startupCommand?: string`**: Simpler. The field is consumed once by `usePtyIpc`/`TerminalInstance` on PTY creation, then cleared. This keeps everything in the store.

**Recommendation**: Option B. Add `startupCommand?: string` to `TerminalInfo`. The `usePtyIpc` hook writes it after the first `pty:data` callback and then calls `clearStartupCommand(id)` so it's not re-executed.

---

## UI

### Template Launcher

A new panel/dropdown accessible from the tab bar or sidebar. Two options for placement:

**Option A — Tab bar dropdown** (recommended): A dropdown button next to the "+" tab button. Clicking it shows a list of saved templates. Clicking a template instantiates it.

```
[Group 1] [Group 2] [+] [v Templates]
                          ├─ Backend Dev    (BE)
                          ├─ Frontend Dev   (FE)
                          ├─ DevOps         (DO)
                          └─ Manage Templates...
```

**Option B — Sidebar section**: A collapsible "Templates" section in the sidebar above the terminal list.

### Template Manager

"Manage Templates..." opens a modal or dedicated panel where the user can:

- **View** all templates as cards showing name, icon, color preview, layout diagram
- **Create** a new template (form-based or "Save current layout as template")
- **Edit** a template (modify name, icon, color, gradient, terminal slots)
- **Delete** a template
- **Duplicate** a template
- **Import/Export** (copy JSON to clipboard, or open the file in an external editor)

#### "Save Current Layout as Template"

A quick way to template-ify an existing group:
1. User right-clicks a group tab or uses a menu action
2. The current group's split tree is walked, converting each `SplitLeaf` back into a `TerminalSlot` (using the terminal's current `title`, `cwd`, empty `startupCommand`)
3. The group's visual properties (`icon`, `color`, `backgroundGradient`) are copied
4. User is prompted to name the template
5. Template is saved

### Group Tab Visual Changes

The group tab bar needs to render the new visual properties:

```
[BE Backend Dev] [FE Frontend Dev] [+] [v]
 ^icon  ^label    ^icon  ^label
 teal background   blue background
```

- **Icon**: Rendered before the label in the tab, small and monospace
- **Color**: Applied as the tab's accent/border-bottom color (replaces the default `#007acc` blue)
- **Background gradient**: Applied to the `.terminal-group-container` as a subtle CSS `linear-gradient` background. Terminals render on top with their normal xterm background. The gradient shows through in the title bars and any chrome/padding between panes.

### Title Bar Tinting

Each `TerminalPane` title bar (`terminal-title-bar`) gets a subtle tint from the group's `color`:

```css
/* If group has color, override title bar background */
.terminal-title-bar {
  background: var(--group-color-bg, #2d2d2d);
}
```

The tint is very subtle — mix the group color at ~10-15% opacity with the default dark background.

---

## Visual Design — Background Gradient

The background gradient is intentionally subtle. All colors should be very close to black (`#0d0d0d` to `#1a1a1a` range). The gradient serves as a visual identity cue, not a distraction.

### Application

The gradient is set as a CSS `linear-gradient` on the `.terminal-group-container`:

```css
.terminal-group-container {
  background: linear-gradient(
    var(--group-gradient-angle, 135deg),
    var(--group-gradient-from, #1e1e1e),
    var(--group-gradient-to, #1e1e1e)
  );
}
```

CSS custom properties are set inline on the container div via React:

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

The gradient is visible in:
- Pane title bars (via `--group-color-bg`)
- Split divider/sash gaps (thin lines between panes)
- The outer container behind all panes

The xterm terminal area itself remains solid black (`#000` or `#0d0d0d`) — the gradient does NOT show through the terminal text area.

---

## Implementation Plan

### Step 1: Types & Config

1. Add `LayoutTemplate`, `LayoutNode`, `LayoutLeaf`, `LayoutBranch`, `TerminalSlot` types to a new `src/renderer/store/template-types.ts`
2. Extend `TerminalGroup` with optional `icon`, `color`, `backgroundGradient`
3. Extend `TerminalInfo` with optional `startupCommand`
4. Add template IPC channels to preload API

### Step 2: Template Storage (Main Process)

1. Add `src/main/template-manager.ts` — reads/writes `templates.json` from app data dir
2. Register IPC handlers for `templates:list`, `templates:save`, `templates:get-path`
3. Create default empty file on first launch

### Step 3: Template Instantiation (Store)

1. Add `instantiateTemplate(template: LayoutTemplate): string` to the store
2. Implement tree walker that converts `LayoutNode` → `SplitNode` + creates `TerminalInfo` entries
3. Create the group with visual properties from the template

### Step 4: Startup Command Execution

1. Add `startupCommand?: string` to `TerminalInfo`
2. Add `clearStartupCommand(id: TerminalId): void` action
3. In `usePtyIpc` or `TerminalInstance`, after first `pty:data` event, write `startupCommand + '\r'` and clear it

### Step 5: Group Visual Properties (CSS)

1. Update `TerminalPanel.tsx` to pass CSS custom properties to group containers
2. Update `tabs.css` — tab icon rendering, per-group accent color
3. Update `splitpane.css` — title bar tinting via `--group-color-bg`
4. Add `colorUtils.ts` with `mixColor()` helper (simple linear interpolation in RGB)
5. Update `TerminalTabs.tsx` to render icon and color

### Step 6: Template Launcher UI

1. Add template dropdown button next to the "+" in the tab bar
2. Fetch templates from main process on dropdown open
3. Click template → call `instantiateTemplate()`
4. "Manage Templates..." link at the bottom

### Step 7: Template Manager

1. Build template list/card view
2. Create/edit form: name, icon, color picker, gradient color pickers, angle slider
3. Layout editor: visual tree builder or JSON editor
4. "Save current layout as template" action on group tab context menu
5. Delete / duplicate actions

### Step 8: Tests

1. Template tree walker (LayoutNode → SplitNode conversion) — pure function, unit testable
2. Template file read/write (main process)
3. `instantiateTemplate` store action
4. Startup command delivery in `usePtyIpc`
5. Visual property rendering (CSS custom properties applied correctly)

---

## Example Templates JSON

```json
[
  {
    "id": "tpl-backend",
    "name": "Backend Dev",
    "icon": "BE",
    "color": "#2d8a6e",
    "backgroundGradient": { "from": "#0a1a14", "to": "#0d0d0d", "angle": 135 },
    "layout": {
      "type": "branch",
      "direction": "horizontal",
      "ratio": 0.333,
      "first": {
        "type": "branch",
        "direction": "vertical",
        "ratio": 0.5,
        "first": { "type": "leaf", "terminal": { "title": "API Server", "cwd": "C:/projects/api", "startupCommand": "npm run dev" } },
        "second": { "type": "leaf", "terminal": { "title": "Shell", "cwd": "C:/projects/api" } }
      },
      "second": {
        "type": "branch",
        "direction": "horizontal",
        "ratio": 0.5,
        "first": {
          "type": "branch",
          "direction": "vertical",
          "ratio": 0.5,
          "first": { "type": "leaf", "terminal": { "title": "Worker", "cwd": "C:/projects/worker", "startupCommand": "npm run worker" } },
          "second": { "type": "leaf", "terminal": { "title": "Shell", "cwd": "C:/projects/worker" } }
        },
        "second": {
          "type": "branch",
          "direction": "vertical",
          "ratio": 0.5,
          "first": { "type": "leaf", "terminal": { "title": "Logs", "cwd": "C:/projects/infra", "startupCommand": "tail -f logs/app.log" } },
          "second": { "type": "leaf", "terminal": { "title": "Shell", "cwd": "C:/projects/infra" } }
        }
      }
    }
  },
  {
    "id": "tpl-frontend",
    "name": "Frontend",
    "icon": "FE",
    "color": "#6e8ad4",
    "backgroundGradient": { "from": "#0d1020", "to": "#0d0d0d", "angle": 160 },
    "layout": {
      "type": "branch",
      "direction": "horizontal",
      "ratio": 0.5,
      "first": { "type": "leaf", "terminal": { "title": "Dev Server", "cwd": "C:/projects/frontend", "startupCommand": "npm run dev" } },
      "second": {
        "type": "branch",
        "direction": "vertical",
        "ratio": 0.5,
        "first": { "type": "leaf", "terminal": { "title": "Tests", "cwd": "C:/projects/frontend", "startupCommand": "npm run test:watch" } },
        "second": { "type": "leaf", "terminal": { "title": "Shell", "cwd": "C:/projects/frontend" } }
      }
    }
  },
  {
    "id": "tpl-simple-grid",
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
| `src/renderer/store/types.ts` | Add `icon`, `color`, `backgroundGradient` to `TerminalGroup`; add `startupCommand` to `TerminalInfo` |
| `src/renderer/store/terminal-store.ts` | Add `instantiateTemplate()`, `clearStartupCommand()` actions |
| `src/preload/index.ts` | Add `templates:list`, `templates:save`, `templates:get-path` IPC bridge |
| `src/preload/index.d.ts` | Type declarations for template IPC |
| `src/main/ipc-handlers.ts` | Register template IPC handlers |
| `src/renderer/components/Terminal/TerminalTabs.tsx` | Render group icon + color, add template launcher button |
| `src/renderer/components/Terminal/TerminalPanel.tsx` | Pass CSS custom properties for gradient/color to group containers |
| `src/renderer/hooks/usePtyIpc.ts` | Execute startup command after first `pty:data` |
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
- Per-terminal color/theme overrides (beyond the group-level gradient)
- Template variables/placeholders (e.g., `${projectDir}`)
- Auto-launch templates on app start
- Template keyboard shortcuts
