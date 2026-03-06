# Layout Templates Implementation Plan

## Context

Layout templates let users launch pre-configured terminal groups in one click. A template defines a split layout tree where each pane has a title, working directory, shell, and optional startup command. Groups get visual identity through an icon, accent color, and subtle background gradient. This is the next major feature after Phase 5 (polish) and Phase 6 (extensibility scaffolding). Full spec: `docs/prd-layout-templates.md`.

---

## Implementation Steps

### Step 1: Template Types

**Create `src/shared/template-types.ts`** — shared across main/preload/renderer.

Types: `TerminalSlot`, `LayoutLeaf`, `LayoutBranch`, `LayoutNode`, `BackgroundGradient`, `LayoutTemplate`.

`TerminalSlot` includes `claudeCode?: boolean` (type only, detection is a separate PRD).

### Step 2: Extend Core Types

**Modify `src/renderer/store/types.ts`**:
- `TerminalInfo` gains `startupCommand?: string`, `claudeCode?: boolean`
- `TerminalGroup` gains `icon?: string`, `color?: string`, `backgroundGradient?: { from; to; angle? }`
- `TerminalState` gains `instantiateLayout(template): string`, `clearStartupCommand(id): void`

### Step 3: Template-to-SplitNode Conversion

**Create `src/renderer/lib/template-utils.ts`**

Pure function `instantiateLayoutNode(layout, nextTerminalNumber)` that walks a `LayoutNode` tree and returns:
- `splitTree: SplitNode` (with generated UUIDs)
- `terminals: TerminalInfo[]` (to add to store map)
- `startupCommands: Array<{ terminalId, command }>` (for deferred exec)

Threads `nextTerminalNumber` through recursion (no mutation). Uses `assertNever` pattern from `tree-utils.ts`.

### Step 4: Store Actions

**Modify `src/renderer/store/terminal-store.ts`**:

`instantiateLayout(template)`:
1. Calls `instantiateLayoutNode(template.layout, state.nextTerminalNumber)`
2. Adds all terminals to `state.terminals`
3. Creates group with template's `name`, `icon`, `color`, `backgroundGradient`
4. Sets first terminal as active, increments counters
5. Returns `groupId`

`clearStartupCommand(id)`: Deletes `startupCommand` from `TerminalInfo`.

### Step 5: Template Storage (Main Process)

**Add to `src/shared/ipc-types.ts`**: `TEMPLATES_LIST`, `TEMPLATES_SAVE`, `TEMPLATES_GET_PATH` channels.

**Create `src/main/template-storage.ts`**: `TemplateStorage` class reads/writes `%APPDATA%/terminal-manager/templates.json`. Auto-creates directory on first use. Returns `[]` on missing/corrupt file.

**Modify `src/main/ipc-handlers.ts`**: Register 3 invoke/handle handlers for template CRUD.

### Step 6: Preload & Renderer IPC

**Modify `src/preload/index.ts`**: Add `listTemplates()`, `saveTemplates()`, `getTemplatesPath()`.

**Modify `src/preload/index.d.ts`**: Add matching type declarations.

**Modify `src/renderer/lib/ipc-api.ts`**: Add `listTemplatesSafe()`, `saveTemplatesSafe()` wrappers.

**Modify `src/renderer/__tests__/setup.ts`**: Mock the 3 new electronAPI methods.

### Step 7: Startup Command Execution

**Modify `src/renderer/lib/pty-dispatcher.ts`**:
- Add `firstDataCallbacks: Map<string, () => void>`
- Add `registerFirstDataCallback(id, callback)` export
- In `onPtyData` handler: fire one-shot callback on first data, then delete
- Clean up in `unregisterTerminal` and `_resetForTesting`

**Modify `src/renderer/components/Terminal/TerminalInstance.tsx`**:
- After `ipcApi.createPty()`, check `terminals[terminalId].startupCommand` from store
- If present, call `registerFirstDataCallback(terminalId, () => { setTimeout(() => writePty(id, cmd + '\r'), 100); clearStartupCommand(id) })`
- 100ms delay lets the shell prompt render before the command is typed

### Step 8: Group Visual Properties (CSS)

**Create `src/renderer/lib/color-utils.ts`**: `hexToRgba(hex, alpha)` and `buildGradient(gradient)`.

**Modify `src/renderer/components/Terminal/TerminalPanel.tsx`**:
- Set inline CSS custom properties on `.terminal-group-container`:
  - `--tm-group-color`: group's accent color
  - `--tm-group-color-bg`: `hexToRgba(color, 0.08)` for subtle title bar tinting
  - `--tm-group-gradient`: `buildGradient(gradient)` for container background

**Modify CSS files**:
- `splitpane.css`: Title bar background uses layered gradient over base: `background: linear-gradient(var(--tm-group-color-bg, transparent), var(--tm-group-color-bg, transparent)), var(--tm-titlebar-bg)`
- `terminal.css`: `.terminal-group-container` gets `background: var(--tm-group-gradient, none)`
- `tabs.css`: Active tab uses `border-bottom-color: var(--tm-group-color, var(--tm-accent))`; add `.terminal-tab-icon` styles

**Modify `src/renderer/components/Terminal/TerminalTabs.tsx`**:
- Set `--tm-group-color` inline per tab
- Render `group.icon` as `<span className="terminal-tab-icon">` before label

### Step 9: Template Launcher Dropdown

**Create `src/renderer/components/Terminal/TemplateLauncher.tsx`**:
- Dropdown button (down triangle) next to "+" in tab bar
- Fetches templates from main process on open
- Lists templates with icon, name, color dot
- Click fires `instantiateLayout(template)`
- Click-outside-to-close behavior

**Modify `src/renderer/components/Terminal/TerminalTabs.tsx`**: Render `<TemplateLauncher />` after "+" button.

**Add dropdown CSS to `tabs.css`**: `.template-launcher`, `.template-dropdown`, `.template-dropdown-item`.

### Step 10: Template Manager Modal

**Create `src/renderer/components/Terminal/TemplateManager.tsx`**:
- Modal overlay with template list + editor form (name, icon, color picker)
- "Save current layout as template" button
- Delete, duplicate actions
- Auto-saves to main process on every change

**Create `src/renderer/lib/layout-capture.ts`**: `captureLayout(splitTree, terminals)` — inverse of `instantiateLayoutNode`, walks `SplitNode` tree to produce `LayoutNode`.

**Create `src/renderer/assets/styles/template-manager.css`**: Modal styles using existing `--tm-*` variables.

**Modify `src/renderer/components/Terminal/TerminalTabs.tsx`**: Add state for modal open/close, gear button to open it.

---

## Files Summary

### New Files (8)
| File | Purpose |
|------|---------|
| `src/shared/template-types.ts` | Template data model types |
| `src/main/template-storage.ts` | File I/O for templates.json |
| `src/renderer/lib/template-utils.ts` | LayoutNode-to-SplitNode conversion |
| `src/renderer/lib/layout-capture.ts` | SplitNode-to-LayoutNode (save current) |
| `src/renderer/lib/color-utils.ts` | hexToRgba, buildGradient |
| `src/renderer/components/Terminal/TemplateLauncher.tsx` | Dropdown UI |
| `src/renderer/components/Terminal/TemplateManager.tsx` | CRUD modal |
| `src/renderer/assets/styles/template-manager.css` | Modal styles |

### Modified Files (12)
| File | Changes |
|------|---------|
| `src/shared/ipc-types.ts` | 3 template channel names |
| `src/renderer/store/types.ts` | Optional fields on TerminalInfo/TerminalGroup, 2 new actions |
| `src/renderer/store/terminal-store.ts` | instantiateLayout, clearStartupCommand |
| `src/main/ipc-handlers.ts` | 3 template IPC handlers |
| `src/preload/index.ts` | 3 template bridge methods |
| `src/preload/index.d.ts` | Type declarations |
| `src/renderer/lib/ipc-api.ts` | Safe wrappers |
| `src/renderer/lib/pty-dispatcher.ts` | firstDataCallbacks for startup commands |
| `src/renderer/components/Terminal/TerminalInstance.tsx` | Startup command execution |
| `src/renderer/components/Terminal/TerminalTabs.tsx` | Icon, color, launcher + manager integration |
| `src/renderer/components/Terminal/TerminalPanel.tsx` | Group CSS custom properties |
| `src/renderer/assets/styles/tabs.css` | Tab icon, dropdown, group color |
| `src/renderer/assets/styles/splitpane.css` | Title bar tinting |
| `src/renderer/assets/styles/terminal.css` | Group gradient background |

---

## Verification

After each step group, verify:

**Steps 1-4 (types, conversion, store)**: `npm test` — add unit tests for `instantiateLayoutNode` (pure function) and `instantiateLayout` store action.

**Steps 5-6 (IPC)**: `npm run dev` — verify no IPC registration errors in DevTools console.

**Step 7 (startup commands)**: Manually call `instantiateLayout` from DevTools with a template that has `startupCommand: "echo hello"`. Verify the command runs after the shell prompt appears.

**Step 8 (visuals)**: Create a template with `color` and `backgroundGradient`. Verify tab accent color, title bar tinting, and container gradient display correctly. Verify non-template groups remain unstyled.

**Steps 9-10 (UI)**: Click the dropdown, select a template, verify the group launches with correct layout and startup commands. Open the template manager, save current layout, edit properties, verify persistence after app restart.

---

## Known Limitations

- **Allotment ratios**: `SplitBranch.ratio` is stored but allotment defaults to 50/50 (no `preferredSize` passed). Making allotment respect ratios is a separate enhancement.
- **Startup command timing**: 100ms delay after first `pty:data`. Shells with slow startup (e.g., PowerShell loading modules) may need a longer delay. Could make configurable later.
- **Template file corruption**: Returns `[]` on parse failure. No backup mechanism yet.
