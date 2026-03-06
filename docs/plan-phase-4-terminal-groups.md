# Phase 4: Terminal Groups / Tabs

## Context

Phase 3 (split panes) is complete. The app has a single global `splitTree` and `activeTerminalId`. Phase 4 introduces terminal groups -- each group has its own independent split layout and active terminal. A tab bar above the terminal area lets users switch between groups. This enables organizing terminals by task/project (e.g., "Frontend" group, "Backend" group).

## State Changes

### `src/renderer/store/types.ts`

**Remove** from `TerminalState`:
- `activeTerminalId: TerminalId | null`
- `splitTree: SplitNode | null`

**Add** to `TerminalState`:
- `groups: TerminalGroup[]` (ordered array, position = tab order)
- `activeGroupId: string | null`
- `nextGroupNumber: number`

**Keep `TerminalGroup` as-is** (already defined but unused):
```typescript
interface TerminalGroup {
  id: string
  label: string
  splitTree: SplitNode        // non-nullable: a group always has >= 1 terminal
  activeTerminalId: TerminalId // non-nullable: same reason
}
```

**New action signatures** on `TerminalState`:
- `addGroup: () => string`
- `removeGroup: (groupId: string) => void`
- `setActiveGroup: (groupId: string) => void`
- `renameGroup: (groupId: string, label: string) => void`

**Existing actions** -- signatures unchanged, behavior becomes group-aware.

### `src/renderer/store/terminal-store.ts` -- Full Rewrite of Actions

**Initial state:**
```
terminals: {}, groups: [], activeGroupId: null, nextTerminalNumber: 1, nextGroupNumber: 1
```

**`addGroup()`:**
1. Create a new terminal (uuid, TerminalInfo)
2. Create a TerminalGroup with label `"Group {nextGroupNumber}"`, splitTree as single leaf, activeTerminalId = new terminal
3. Push to `groups` array
4. Set `activeGroupId` to new group
5. Increment counters
6. Return group id

**`removeGroup(groupId)`:**
1. Find group, collect all terminal IDs via `collectLeafIds(group.splitTree)`
2. Delete all those terminals from `terminals` map
3. Remove group from `groups` array
4. If was active group: set `activeGroupId` to adjacent group (prefer left/previous), or `null` if none remain

**`addTerminal()`:**
1. If no active group exists, delegate to `addGroup()` (which creates group + terminal)
2. Otherwise: create terminal, add to active group's split tree by splitting `activeTerminalId` horizontally (using existing `splitNode` util)
3. Set as group's `activeTerminalId`

**`removeTerminal(id)`:**
1. Find owning group by scanning `groups` with `containsLeaf()`
2. Delete terminal from `terminals` map
3. `removeNode()` from group's split tree
4. If tree becomes null (last terminal): remove the group (inline `removeGroup` logic)
5. Otherwise: if removed terminal was group's `activeTerminalId`, reassign to first leaf via `collectLeafIds()`

**`splitTerminal(id, direction)`:**
1. Find owning group via `containsLeaf()`
2. Create new terminal, `splitNode()` on that group's tree
3. Set group's `activeTerminalId` to new terminal

**`setActiveTerminal(id)`:**
1. Find owning group via `containsLeaf()`
2. Set that group's `activeTerminalId = id`
3. Also set `activeGroupId` to that group (auto-switch groups when clicking sidebar item)

**`renameTerminal`, `setTerminalDead`** -- no changes (operate on flat `terminals` map).

### `src/renderer/lib/tree-utils.ts` -- No changes needed

Existing `splitNode`, `removeNode`, `collectLeafIds`, `containsLeaf` are all pure functions that operate on `SplitNode`. They don't need group awareness -- the store finds the right group first, then applies these utilities to that group's tree.

## Component Changes

### New: `src/renderer/components/Terminal/TerminalTabs.tsx`

Tab bar component rendered at top of `TerminalPanel`. Reads `groups`, `activeGroupId` from store.

- Renders one tab per group (in array order) with label + close button (visible on hover)
- Active tab highlighted with bottom border accent
- Double-click tab label to rename (same pattern as `TerminalListItem` inline edit)
- "+" button at end of tab strip calls `addGroup()`
- Click tab calls `setActiveGroup(groupId)`
- Close button calls `removeGroup(groupId)`

### Modified: `src/renderer/components/Terminal/TerminalPanel.tsx`

Currently reads global `splitTree`. Change to:

```
<div className="terminal-panel">
  <TerminalTabs />
  <div className="terminal-panel-content">
    {groups.length === 0 ? <empty message> : (
      groups.map(group => (
        <div key={group.id}
             className="terminal-group-container"
             style={{ display: group.id === activeGroupId ? 'flex' : 'none' }}>
          <SplitContainer node={group.splitTree} groupId={group.id} />
        </div>
      ))
    )}
  </div>
</div>
```

All groups' SplitContainers render simultaneously. Inactive groups hidden via `display: none`. This preserves xterm instances and scrollback across group switches. Group containers use `position: absolute` stacking inside a `position: relative` parent.

### Modified: `src/renderer/components/SplitPane/SplitContainer.tsx`

Add `groupId: string` prop, pass through to `TerminalPane` and recursive children:

```typescript
interface SplitContainerProps {
  node: SplitNode
  groupId: string
}
```

Leaf renders: `<TerminalPane terminalId={node.terminalId} groupId={groupId} />`
Branch renders: recursive `<SplitContainer node={...} groupId={groupId} />`

### Modified: `src/renderer/components/Terminal/TerminalPane.tsx`

Add `groupId: string` prop. Change selectors:

- `isActive`: `s.groups.find(g => g.id === groupId)?.activeTerminalId === terminalId`
- `isGroupActive`: `s.activeGroupId === groupId`
- Pass `isVisible={isGroupActive}` to `TerminalInstance` (instead of hardcoded `true`)

This ensures hidden group terminals don't fire resize events and refit when shown.

### Modified: `src/renderer/components/Sidebar/SidebarActions.tsx`

Add a "New Group" button alongside existing "+" (New Terminal):

```tsx
<button className="sidebar-btn" onClick={addTerminal} title="New Terminal">+</button>
<button className="sidebar-btn" onClick={addGroup} title="New Group">&#8862;</button>
```

### Modified: `src/renderer/components/Sidebar/TerminalList.tsx`

Filter to active group's terminals only (instead of showing all):

1. Read `groups` and `activeGroupId` from store
2. Find active group, call `collectLeafIds(activeGroup.splitTree)` to get terminal IDs
3. Map those IDs to `terminals` map, sort by `createdAt`
4. Derive `activeTerminalId` from active group (not global store)

### Modified: `src/renderer/App.tsx`

Change init from `addTerminal()` to `addGroup()`:
```tsx
const addGroup = useTerminalStore((s) => s.addGroup)
// in useEffect:
addGroup()
```

## New CSS: `src/renderer/assets/styles/tabs.css`

Tab bar styling (~30px tall, dark background, VS Code-style):
- `.terminal-tabs` -- flex row, `height: 30px`, dark bg, border-bottom, overflow-x auto
- `.terminal-tab` -- flex item, padding, cursor pointer, border-right separator
- `.terminal-tab.active` -- lighter bg, bottom accent border (#007acc)
- `.terminal-tab-label` -- 12px, ellipsis overflow
- `.terminal-tab-close` -- hidden by default, shown on hover, red on hover
- `.terminal-tab-add` -- "+" button at end of tab strip
- `.terminal-tab-rename-input` -- inline edit input (same pattern as sidebar rename)

## CSS Modifications

### `src/renderer/assets/styles/terminal.css`

Update `.terminal-panel` to flex column (holds tabs above content):
```css
.terminal-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
```

Add group container stacking styles:
```css
.terminal-panel-content { flex: 1; position: relative; overflow: hidden; }
.terminal-group-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
```

## Files Unchanged

- `src/main/*` -- PTY layer is terminal-ID-based, group-unaware
- `src/preload/*` -- IPC contract unchanged
- `src/renderer/hooks/usePtyIpc.ts` -- `setTerminalDead` works on flat `terminals` map
- `src/renderer/lib/ipc-api.ts` -- re-export, unchanged
- `src/renderer/lib/constants.ts` -- no new constants
- `src/renderer/components/Layout/MainLayout.tsx` -- just renders Sidebar + TerminalPanel
- `src/renderer/components/Terminal/TerminalInstance.tsx` -- already handles `isVisible` correctly
- `src/renderer/components/Sidebar/TerminalListItem.tsx` -- receives props, calls store actions (now group-aware)

## Implementation Order

1. **types.ts** -- Update `TerminalState` interface
2. **terminal-store.ts** -- Rewrite store with group-aware actions
3. **TerminalTabs.tsx** -- Create new tab bar component
4. **tabs.css** -- Create tab bar styles
5. **terminal.css** -- Add group container styles, update `.terminal-panel`
6. **TerminalPanel.tsx** -- Render tabs + stacked group containers
7. **SplitContainer.tsx** -- Add `groupId` prop passthrough
8. **TerminalPane.tsx** -- Use `groupId` for selectors, pass `isVisible`
9. **TerminalList.tsx** -- Filter to active group
10. **SidebarActions.tsx** -- Add "New Group" button
11. **App.tsx** -- Change init to `addGroup()`
12. **terminal-store.test.ts** -- Update all tests for new state shape, add group tests

## Test Updates (`terminal-store.test.ts`)

**`beforeEach` reset** changes to:
```typescript
useTerminalStore.setState({
  terminals: {}, groups: [], activeGroupId: null,
  nextTerminalNumber: 1, nextGroupNumber: 1
})
```

**Existing tests** need selector updates:
- `store().splitTree` -> `activeGroup().splitTree` (via helper)
- `store().activeTerminalId` -> `activeGroup().activeTerminalId`

**New test cases:**
- `addGroup` creates group with one terminal, sets active
- Multiple `addGroup` creates independent groups
- `removeGroup` removes all group terminals, switches active
- `setActiveGroup` switches active group
- `renameGroup` updates label
- `addTerminal` adds to active group's split tree
- `removeTerminal` last-in-group removes the group
- `setActiveTerminal` on terminal in different group auto-switches group
- Cross-group isolation: operations on one group don't affect another

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Allotment sizing inside `display: none` | `TerminalInstance` already has `isVisible` guard + refit on show via `useEffect` with `requestAnimationFrame` |
| Multiple SplitContainers in DOM | Groups typically few (2-5). Memory fine for personal use. Absolute positioning prevents layout interference |
| Finding owning group via `containsLeaf` scan | O(groups * tree_depth). Negligible for <10 groups. No optimization needed |
| PTY cleanup on group removal | TerminalInstance unmount triggers `destroyPty` via useEffect cleanup. React unmount is synchronous for removed group. Existing `catch(() => {})` handles already-dead PTYs |

## Verification

1. `npm run dev` -- app launches, default group created with one terminal
2. Create multiple groups via tab bar "+" -- each starts with own terminal
3. Switch between groups -- split layouts preserved, scrollback intact
4. Add terminals to a group (sidebar "+") -- appears in active group's split tree
5. Split terminals within a group -- works independently per group
6. Close a terminal -- removed from group; closing last terminal removes the group
7. Close a group via tab close button -- all terminals cleaned up
8. Rename group via double-click on tab
9. Click terminal in sidebar auto-switches to its group
10. Check DevTools console for IPC errors
11. Check Task Manager for orphaned PTY processes after closing groups
12. `npm test` -- all updated tests pass
