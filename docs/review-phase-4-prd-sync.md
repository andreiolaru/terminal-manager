# PRD Post-Phase 4 Sync

## Context

Phase 4 (Terminal Groups / Tabs) has been implemented. The PRD needs to be updated to reflect the actual implementation. Each change below identifies the source (code vs implementation decision) and the specific PRD location.

## Changes

### 1. Project Structure: Add `tabs.css` (line 52)

**Source**: `src/renderer/assets/styles/tabs.css` was created in Phase 4 for group tab bar styling.

Add `tabs.css` after `splitpane.css` in the file tree:
```
│       │   ├── splitpane.css
│       │   └── tabs.css
```

### 2. Data Model: Update `TerminalState` to match implementation (lines 163-167)

**Source**: `src/renderer/store/types.ts` lines 36-54. The PRD had a simplified sketch; the actual type includes action methods, `nextTerminalNumber`, `nextGroupNumber`, and `activeGroupId` is nullable.

Replace the `TerminalState` interface with:
```typescript
interface TerminalState {
  terminals: Record<TerminalId, TerminalInfo>;
  groups: TerminalGroup[];
  activeGroupId: string | null;  // null when no groups exist
  nextTerminalNumber: number;
  nextGroupNumber: number;

  // Group actions
  addGroup: () => string;
  removeGroup: (groupId: string) => void;
  setActiveGroup: (groupId: string) => void;
  renameGroup: (groupId: string, label: string) => void;

  // Terminal actions (group-aware)
  addTerminal: () => TerminalId;
  removeTerminal: (id: TerminalId) => void;
  splitTerminal: (id: TerminalId, direction: SplitDirection) => void;
  setActiveTerminal: (id: TerminalId) => void;
  renameTerminal: (id: TerminalId, title: string) => void;
  setTerminalDead: (id: TerminalId) => void;
}
```

### 3. Component Tree: Update `SplitContainer` signature (line 199, 211)

**Source**: `src/renderer/components/SplitPane/SplitContainer.tsx`. Phase 4 added a `groupId` prop threaded through the recursive tree so `TerminalPane` can derive `isActive` and `isVisible` per-group.

Line 199: `<SplitContainer node={activeGroup.splitTree}>` becomes `<SplitContainer node={activeGroup.splitTree} groupId={activeGroup.id}>`

Lines 211-225: Update the code sample to include `groupId`:
```tsx
function SplitContainer({ node, groupId }: { node: SplitNode; groupId: string }) {
  if (node.type === 'leaf') {
    return <TerminalPane terminalId={node.terminalId} groupId={groupId} />;
  }
  return (
    <Allotment vertical={node.direction === 'vertical'}>
      <Allotment.Pane>
        <SplitContainer node={node.first} groupId={groupId} />
      </Allotment.Pane>
      <Allotment.Pane>
        <SplitContainer node={node.second} groupId={groupId} />
      </Allotment.Pane>
    </Allotment>
  );
}
```

### 4. TerminalPane signature: Add `groupId` prop (line 237)

**Source**: `src/renderer/components/Terminal/TerminalPane.tsx`. The `groupId` prop enables per-group `isActive` derivation (checks group's `activeTerminalId` instead of a global one) and controls `isVisible` on `TerminalInstance`.

Line 237: Update signature to `function TerminalPane({ terminalId, groupId }: { terminalId: TerminalId; groupId: string })`

### 5. Tree Utilities: Update function list (lines 261-263)

**Source**: `src/renderer/lib/tree-utils.ts`. The actual implementation has `collectLeafIds` and `containsLeaf` instead of `findNode`.

Replace lines 261-263 with:
```
- **`splitNode(tree, targetId, direction, newTerminalId)`** → replaces leaf with branch containing original + new leaf
- **`removeNode(tree, targetId)`** → replaces parent branch with surviving sibling
- **`collectLeafIds(tree)`** → returns flat array of all terminal IDs in tree
- **`containsLeaf(tree, terminalId)`** → checks if a terminal exists in the tree
```

### 6. Phase markers: Mark Phases 2-4 as COMPLETE (lines 307, 314, 324)

**Source**: All three phases are implemented and verified.

- Line 307: `### Phase 2: Multiple Terminals + Sidebar` → `### Phase 2: Multiple Terminals + Sidebar [COMPLETE]`
- Line 314: `### Phase 3: Split Panes` → `### Phase 3: Split Panes [COMPLETE]`
- Line 324: `### Phase 4: Terminal Groups / Tabs` → `### Phase 4: Terminal Groups / Tabs [COMPLETE]`

### 7. Phase 4: Add implementation notes (after line 329)

**Source**: Implementation decisions made during Phase 4.

Add after the existing Phase 4 bullets:
```
- Sidebar filters terminal list to active group only (clicking a terminal in another group auto-switches)
- Closing the last terminal in a group removes the group (moved from Phase 5 scope)
- All groups' SplitContainers rendered simultaneously, inactive hidden via CSS `display: none` + absolute positioning
- `TerminalPane` receives `groupId` prop for per-group `isActive`/`isVisible` selectors
- **Verified**: Groups created/switched/closed, independent split layouts, scrollback preserved across switches
```

### 8. Phase 5: Remove already-implemented item (line 335)

**Source**: "last terminal closes group" was implemented in Phase 4's `removeTerminal` action.

Line 335: Change from:
`- Edge cases: last terminal closes group, last group creates default, window title tracks active terminal`
to:
`- Edge cases: last group creates default, window title tracks active terminal`

## Verification

After edits, scan the PRD to confirm:
- All phase markers match CLAUDE.md's checkboxes
- Code samples compile conceptually against `src/renderer/store/types.ts`
- No stale references to removed global `splitTree` or `activeTerminalId` in the TerminalState section
