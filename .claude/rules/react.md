---
paths:
  - "src/renderer/components/**"
  - "src/renderer/App.tsx"
---

# React Architecture Rules

## Terminal Instance Lifecycle

- xterm instance stored in `useRef` — never recreate on re-render
- Hidden terminals use `display: none`, NOT unmount (preserves scrollback)
- `FitAddon.fit()` called after layout stabilizes via `requestAnimationFrame`
- Resize events debounced (75ms) with rAF, skipped when hidden

## State Management

- Single Zustand store with immer middleware for nested mutations
- Split layout is a recursive binary tree (`SplitNode = SplitLeaf | SplitBranch`)
- Tree utilities are pure functions with structural sharing (referential equality)
- Store actions call `destroyPtySafe` for PTY cleanup — don't rely solely on unmount

## Memoization Strategy

- `React.memo` on `SplitContainer` — tree-utils preserve referential equality, so unchanged subtrees short-circuit
- `React.memo` on `TerminalPane` — prevents re-render from parent when props unchanged
- `useCallback` on all TerminalPane event handlers
- Store selectors return primitives or stable references where possible

## Centralized IPC Dispatch

- `src/renderer/lib/pty-dispatcher.ts` — single global `onPtyData`/`onPtyExit` listener
- `Map<terminalId, Terminal>` for O(1) data routing
- Components call `registerTerminal`/`unregisterTerminal`, not direct IPC listeners

## Component Hierarchy

```
App > MainLayout
  > Sidebar (TerminalList, SidebarActions)
  > TerminalPanel > TerminalTabs
    > [per group, display:none for inactive]
      > SplitContainer (recursive) > TerminalPane > TerminalInstance (xterm ref)
```

## Common Pitfalls

- Don't create new xterm instances on re-render (use refs)
- Don't unmount terminal components to "hide" them (kills scrollback)
- Don't skip `requestAnimationFrame` before `fitAddon.fit()` after layout changes
- Don't subscribe to entire `groups` array when you only need specific fields
- Allotment needs explicit `width/height: 100%` on containers or sizing breaks
- `SplitErrorBoundary` wraps `SplitContainer` — errors in one pane don't crash the app
