# Phase 3: Split Panes

## Context

Phase 1-2 are complete: single/multi terminal, sidebar, store, tests (65 passing). Phase 3 adds split panes using allotment + a recursive binary tree layout. Currently, `TerminalPanel` renders all terminals in a flat list with only the active one visible. Phase 3 replaces this with a recursive split tree where each leaf is a `TerminalPane` (title bar + xterm instance), and branches use `<Allotment>` for resizable splits.

The split tree types (`SplitNode`, `SplitLeaf`, `SplitBranch`) are already defined in `types.ts`. No main process or preload changes needed.

## Design Decisions

**Groups deferred to Phase 4.** Phase 3 uses a single implicit split tree in the store (no `groups` array yet). This keeps the scope focused on split mechanics.

**TerminalInstance stays mostly unchanged.** It already handles resize observers, fitAddon, visibility. The key change: it no longer manages its own `position: absolute` overlay — it renders inside a flex container provided by `TerminalPane`.

**Active terminal = focused pane.** Clicking/focusing a terminal in a split updates `activeTerminalId`. The sidebar continues showing all terminals and highlighting the active one.

## Implementation Steps

### Step 1: Install allotment
- `npm install allotment@^1.20`

### Step 2: Create `src/renderer/lib/tree-utils.ts`
Pure functions — no side effects, easy to test:
- `splitNode(tree, targetTerminalId, direction, newTerminalId)` → returns new tree with target leaf replaced by a branch (original + new leaf, 50/50 ratio)
- `removeNode(tree, targetTerminalId)` → returns new tree with leaf removed, parent branch replaced by surviving sibling. Returns `null` if tree is a single leaf being removed.
- `collectLeafIds(tree)` → returns all terminal IDs in the tree (useful for cleanup/validation)
- `containsLeaf(tree, terminalId)` → boolean check

### Step 3: Update `src/renderer/store/types.ts`
Add to `TerminalState`:
- `splitTree: SplitNode | null` (null when no terminals exist)
- `splitTerminal(terminalId, direction)` — creates a new terminal and splits the target pane
- `removeSplitTerminal(terminalId)` — removes terminal from both split tree and terminals map

### Step 4: Update `src/renderer/store/terminal-store.ts`
- Add `splitTree: null` to initial state
- **Modify `addTerminal()`**: if `splitTree` is null, set it to `{ type: 'leaf', terminalId: id }`. Otherwise leave tree unchanged (sidebar "+" creates a terminal but doesn't auto-split — it replaces the tree with a single leaf for the new terminal if no tree exists).
- **Add `splitTerminal(terminalId, direction)`**: calls `addTerminal()` internally to create a new terminal, then uses `splitNode()` tree-util to insert it next to the target.
- **Modify `removeTerminal(id)`**: also calls `removeNode()` on the split tree. If tree becomes null, set `splitTree` to null.
- **Add `splitTree` to the state interface**

### Step 5: Create `src/renderer/components/SplitPane/SplitContainer.tsx`
Recursive component:
```
if node.type === 'leaf' → render <TerminalPane terminalId={node.terminalId} />
if node.type === 'branch' → render <Allotment vertical={direction === 'vertical'}>
  <Allotment.Pane><SplitContainer node={first} /></Allotment.Pane>
  <Allotment.Pane><SplitContainer node={second} /></Allotment.Pane>
</Allotment>
```

### Step 6: Create `src/renderer/components/Terminal/TerminalPane.tsx`
Wrapper component for each leaf:
- Title bar (~24px): shows terminal title, active highlight
- Action buttons (visible on hover): Split Right, Split Down, Close
- Split Right calls `splitTerminal(id, 'horizontal')`
- Split Down calls `splitTerminal(id, 'vertical')`
- Close calls `removeTerminal(id)`
- Content area: `<TerminalInstance>` with `flex: 1`
- On terminal focus → call `setActiveTerminal(id)`

### Step 7: Update `src/renderer/components/Terminal/TerminalInstance.tsx`
- Remove `position: absolute` assumption — container is now a flex child
- With splits, ALL terminals in the active tree are visible simultaneously. The `isVisible` prop is always `true` when rendered from TerminalPane.

### Step 8: Rewrite `src/renderer/components/Terminal/TerminalPanel.tsx`
- If `splitTree` is not null: render `<SplitContainer node={splitTree} />`
- If `splitTree` is null: render the empty state message
- Remove the old flat-list rendering

### Step 9: Create `src/renderer/assets/styles/splitpane.css`
- `.terminal-pane` — flex column, full size, border for visual separation
- `.terminal-pane.active` — blue left border or top border highlight
- `.terminal-title-bar` — 24px height, flex row, dark background (#2d2d2d), border-bottom
- `.terminal-title-bar .title` — flex 1, ellipsis overflow
- `.terminal-title-actions` — flex row, buttons hidden by default, visible on `.terminal-pane:hover`
- `.terminal-content` — flex 1, overflow hidden (xterm container)
- Allotment sash styling if needed (the drag handle between panes)

### Step 10: Update existing CSS
- `terminal.css`: remove `.terminal-container`'s `position: absolute` — it's now `flex: 1` inside `.terminal-content`
- Import `splitpane.css` in appropriate component

### Step 11: Update tests
- Add unit tests for `tree-utils.ts` (pure functions, high value)
- Update `terminal-store.test.ts` for new split actions
- Add component test for `SplitContainer` (renders leaf/branch correctly)

## Files Created
| File | Purpose |
|------|---------|
| `src/renderer/lib/tree-utils.ts` | Pure split tree manipulation functions |
| `src/renderer/components/SplitPane/SplitContainer.tsx` | Recursive split tree renderer |
| `src/renderer/components/Terminal/TerminalPane.tsx` | Title bar + TerminalInstance wrapper |
| `src/renderer/assets/styles/splitpane.css` | Split pane & title bar styles |
| `src/renderer/lib/__tests__/tree-utils.test.ts` | Tree utility tests |

## Files Modified
| File | Changes |
|------|---------|
| `package.json` | Add allotment dependency |
| `src/renderer/store/types.ts` | Add `splitTree` and new actions to `TerminalState` |
| `src/renderer/store/terminal-store.ts` | Add split tree state, `splitTerminal()`, update `addTerminal()`/`removeTerminal()` |
| `src/renderer/components/Terminal/TerminalPanel.tsx` | Render SplitContainer instead of flat list |
| `src/renderer/components/Terminal/TerminalInstance.tsx` | Minor: remove absolute positioning assumption |
| `src/renderer/assets/styles/terminal.css` | Update `.terminal-container` from absolute to flex |
| `src/renderer/store/__tests__/terminal-store.test.ts` | Add tests for split operations |

## Verification
1. `npm run dev` — app launches, single terminal works as before
2. Click split buttons → pane splits horizontally/vertically
3. Nested splits work (split a split)
4. Close a pane → sibling takes full space, tree collapses correctly
5. Resize handles drag smoothly, xterm refits properly
6. Sidebar shows all terminals, clicking one focuses it in the split view
7. Active pane has visual highlight
8. `npm test` — all tests pass (existing + new)
9. No orphaned PTY processes after closing terminals
