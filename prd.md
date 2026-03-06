# Terminal Manager — PRD & Implementation Plan

## Context

Build a personal-use Windows terminal manager similar to VS Code's integrated terminal. The app provides nestable split panes (horizontal + vertical), a sidebar listing all terminals, and terminal groups/tabs — each group with its own independent split layout. The goal is a minimal but well-structured Electron + React app using xterm.js and node-pty, designed for easy extension with themes and session persistence later.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop framework | **Electron 35** | Chromium + Node, same approach as VS Code |
| UI framework | **React 19 + TypeScript** | Familiar, declarative, great ecosystem |
| Terminal emulation | **@xterm/xterm 5.5** + FitAddon + WebglAddon | Battle-tested, performant |
| PTY backend | **node-pty 1.0** | Microsoft's PTY library, ConPTY on Windows |
| Split panes | **allotment 1.20** | Derived from VS Code's split view, React-native |
| State management | **Zustand 5 + immer** | Minimal boilerplate, ideal for nested tree state |
| Build tool | **electron-vite 3** | Purpose-built for Electron, fast HMR |
| Packaging | **electron-builder** | `dir` target (no installer needed for personal use) |

---

## Project Structure

```
terminal-manager/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
├── electron-builder.yml
├── .gitignore
├── resources/
│   └── icon.ico
├── src/
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # App entry, window creation
│   │   ├── pty-manager.ts             # node-pty instance lifecycle
│   │   └── ipc-handlers.ts            # IPC handler registration
│   ├── preload/                       # Context bridge
│   │   ├── index.ts                   # Exposes electronAPI to renderer
│   │   └── index.d.ts                # Type declarations
│   └── renderer/                      # React app
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── assets/styles/
│       │   ├── global.css
│       │   ├── sidebar.css
│       │   ├── terminal.css
│       │   ├── splitpane.css
│       │   └── tabs.css
│       ├── components/
│       │   ├── Sidebar/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── TerminalList.tsx
│       │   │   ├── TerminalListItem.tsx
│       │   │   └── SidebarActions.tsx
│       │   ├── Terminal/
│       │   │   ├── TerminalPanel.tsx
│       │   │   ├── TerminalPane.tsx      # Title bar + TerminalInstance wrapper
│       │   │   ├── TerminalInstance.tsx
│       │   │   └── TerminalTabs.tsx
│       │   ├── SplitPane/
│       │   │   └── SplitContainer.tsx    # Recursive split renderer
│       │   └── Layout/
│       │       └── MainLayout.tsx
│       ├── store/
│       │   ├── terminal-store.ts         # Zustand store
│       │   └── types.ts                  # All TypeScript types
│       ├── hooks/
│       │   ├── useTerminal.ts
│       │   └── usePtyIpc.ts
│       └── lib/
│           ├── ipc-api.ts
│           ├── tree-utils.ts             # Split tree manipulation
│           └── constants.ts
```

---

## Architecture

### Process Responsibilities

- **Main process**: Window management, PTY lifecycle (node-pty spawn/write/resize/kill), IPC handlers, app lifecycle & cleanup
- **Preload**: `contextBridge.exposeInMainWorld` exposing a typed `electronAPI` — the only communication channel
- **Renderer**: React UI, xterm.js terminal instances, Zustand state, split layout

### IPC Communication

```
Renderer                    Preload Bridge              Main Process
───────                    ──────────────              ────────────
User types in xterm   →   electronAPI.writePty(id,d)  → ipcMain.on('pty:write')  → pty.write(data)
                                                                                        │
xterm.write(data)     ←   onPtyData callback          ← webContents.send('pty:data')  ←┘
```

| Channel | Pattern | Why |
|---------|---------|-----|
| `pty:create` | `invoke/handle` | Renderer awaits creation |
| `pty:write` | `send/on` (fire-and-forget) | Max throughput, no response needed |
| `pty:data` | `webContents.send` → renderer listener | High-frequency push from main |
| `pty:resize` | `send/on` (fire-and-forget) | No response needed |
| `pty:destroy` | `invoke/handle` | Confirmation of cleanup |

### Preload API Surface

```typescript
interface ElectronAPI {
  createPty(options: { id: string; shell?: string; cwd?: string; cols?: number; rows?: number }): Promise<void>;
  writePty(id: string, data: string): void;
  resizePty(id: string, cols: number, rows: number): void;
  destroyPty(id: string): Promise<void>;
  onPtyData(callback: (id: string, data: string) => void): () => void;
  onPtyExit(callback: (id: string, exitCode: number) => void): () => void;
}
```

---

## Data Model

### Core Types (`store/types.ts`)

```typescript
type TerminalId = string; // uuid

interface TerminalInfo {
  id: TerminalId;
  title: string;
  shell: string;
  cwd: string;
  isAlive: boolean;
  createdAt: number;
}

type SplitDirection = 'horizontal' | 'vertical';

interface SplitLeaf {
  type: 'leaf';
  terminalId: TerminalId;
}

interface SplitBranch {
  type: 'branch';
  direction: SplitDirection;
  first: SplitNode;
  second: SplitNode;
  ratio: number; // 0-1, proportion for `first`
}

type SplitNode = SplitLeaf | SplitBranch;

interface TerminalGroup {
  id: string;
  label: string;
  splitTree: SplitNode;
  activeTerminalId: TerminalId;
}

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

### Split Tree Example

```
┌──────────┬──────────┐
│          │  Term B  │
│  Term A  ├──────────┤
│          │  Term C  │
└──────────┴──────────┘

→ { type:'branch', direction:'horizontal', ratio:0.5,
     first:  { type:'leaf', terminalId:'a' },
     second: { type:'branch', direction:'vertical', ratio:0.5,
               first:  { type:'leaf', terminalId:'b' },
               second: { type:'leaf', terminalId:'c' } } }
```

---

## Component Tree

```
<App>
  <MainLayout>
    ├── <Sidebar>
    │   ├── <SidebarActions>          // "+New Terminal", "+New Group"
    │   └── <TerminalList>
    │       └── <TerminalListItem />  // click=focus, dbl-click=rename, x=close
    └── <TerminalPanel>
        ├── <TerminalTabs />          // One tab per group
        └── <SplitContainer node={activeGroup.splitTree} groupId={activeGroup.id}>
            // Recursive:
            // leaf  → <TerminalPane>        // wrapper with title bar
            //             <TerminalTitleBar />  // shows terminal title + split/close buttons
            //             <TerminalInstance />   // xterm.js
            //         </TerminalPane>
            // branch → <Allotment> with two <SplitContainer> children
```

### Split Rendering (recursive)

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

### TerminalPane — Title Bar per Split Pane

Each terminal in a split has a **title bar** at the top showing:
- Terminal title (from store, e.g. "PowerShell - project-dir")
- Visual indicator when focused (highlight/border)
- Action buttons on hover: Split Right, Split Down, Close

```tsx
// TerminalPane.tsx — wraps each terminal leaf in the split tree
function TerminalPane({ terminalId, groupId }: { terminalId: TerminalId; groupId: string }) {
  const title = useTerminalStore(s => s.terminals[terminalId]?.title);
  const isActive = useTerminalStore(s => s.groups.find(g => g.id === groupId)?.activeTerminalId === terminalId);

  return (
    <div className={`terminal-pane ${isActive ? 'active' : ''}`}>
      <div className="terminal-title-bar">
        <span className="terminal-title">{title}</span>
        <div className="terminal-title-actions">
          {/* Split Right, Split Down, Close buttons — visible on hover */}
        </div>
      </div>
      <div className="terminal-content">
        <TerminalInstance terminalId={terminalId} />
      </div>
    </div>
  );
}
```

The title bar is compact (~24px tall), styled like VS Code's terminal tab headers. The `terminal-content` div takes remaining height via `flex: 1`. FitAddon measures this inner container so the title bar doesn't eat into xterm's row count.

### Tree Utilities (`lib/tree-utils.ts`)

- **`splitNode(tree, targetId, direction, newTerminalId)`** → replaces leaf with branch containing original + new leaf
- **`removeNode(tree, targetId)`** → replaces parent branch with surviving sibling
- **`collectLeafIds(tree)`** → returns flat array of all terminal IDs in tree
- **`containsLeaf(tree, terminalId)`** → checks if a terminal exists in the tree

---

## Key Implementation Details

### TerminalInstance Lifecycle

1. `useEffect` on mount: create `xterm.Terminal`, load FitAddon + WebglAddon
2. Call `electronAPI.createPty({ id, shell, cwd })`
3. Subscribe to `onPtyData(id)` → `terminal.write(data)`
4. Attach `terminal.onData()` → `electronAPI.writePty(id, data)`
5. `ResizeObserver` / Allotment `onChange` → `fitAddon.fit()` → `electronAPI.resizePty(id, cols, rows)`
6. On unmount: `electronAPI.destroyPty(id)` + `terminal.dispose()`

**Critical**: Use `useRef` for the xterm instance — never recreate on re-render. Hidden terminals use `display: none` (not unmount) to preserve scrollback.

### Resize Handling

Debounce `resizePty` calls (50-100ms) during split drag to avoid flooding the PTY with resize signals. Call `fitAddon.fit()` after Allotment layout stabilizes (use `requestAnimationFrame`).

### PTY Manager (Main Process)

- `Map<string, IPty>` — one entry per terminal
- `create()`: `pty.spawn(shell, [], { name:'xterm-256color', cols, rows, cwd, env })`
- Pipes `onData` → `webContents.send('pty:data', id, data)` and `onExit` → `webContents.send('pty:exit', id, code)`
- `destroyAll()` on app quit

### Native Module Handling

`node-pty` 1.0 ships **prebuilt binaries** for win32-x64 that are compatible with Electron 35's Node 22 — no `@electron/rebuild` needed for development. For production packaging:
- `asarUnpack: ["node_modules/node-pty/**"]` in electron-builder config (native .node files can't be inside asar)

---

## Implementation Phases

### Phase 1: Scaffold + Single Terminal [COMPLETE]
- Manually scaffolded electron-vite project (React + TypeScript)
- Implemented `pty-manager.ts`, `ipc-handlers.ts`, preload bridge
- Minimal `TerminalInstance.tsx` wired to IPC
- node-pty prebuilds work with Electron out of the box (no rebuild needed)
- **Verified**: App launches, PowerShell prompt works, typing & output functional

### Phase 2: Multiple Terminals + Sidebar [COMPLETE]
- Define types, implement Zustand store (terminals map, CRUD actions)
- Build `MainLayout`, `Sidebar`, `TerminalList`, `TerminalListItem`, `SidebarActions`
- Terminal switching via sidebar (active shown, others `display: none`)
- Add/remove terminals, double-click-to-rename, PTY exit handling
- **Verify**: Create multiple terminals, switch between them, close them

### Phase 3: Split Panes [COMPLETE]
- Install `allotment`, implement `tree-utils.ts`
- Update store to use `SplitNode` tree per group
- Build `TerminalPane.tsx` — wrapper with title bar (terminal name, focus highlight, split/close action buttons) + `TerminalInstance` below it
- Build recursive `SplitContainer.tsx` (leaf nodes render `<TerminalPane>`)
- Split actions via title bar buttons and/or keyboard shortcuts: "Split Right" / "Split Down"
- Wire `FitAddon.fit()` on resize (measure inner `terminal-content` div, not the full pane), handle terminal removal from splits
- Focus tracking via `terminal.onFocus`
- **Verify**: Nest H+V splits, each pane shows its title, resize dividers work, remove terminals from splits

### Phase 4: Terminal Groups / Tabs [COMPLETE]
- Build `TerminalTabs.tsx`, update store with `groups` array
- Each group has independent `splitTree` and `activeTerminalId`
- Group switching preserves terminals via CSS hiding
- New Group / Close Group actions
- Sidebar filters terminal list to active group only (clicking a terminal in another group auto-switches)
- Closing the last terminal in a group removes the group (moved from Phase 5 scope)
- All groups' SplitContainers rendered simultaneously, inactive hidden via CSS `display: none` + absolute positioning
- `TerminalPane` receives `groupId` prop for per-group `isActive`/`isVisible` selectors
- **Verified**: Groups created/switched/closed, independent split layouts, scrollback preserved across switches

### Phase 5: Polish + Keyboard Shortcuts [COMPLETE]
- Shortcuts: `Ctrl+Shift+T` (new), `Ctrl+Shift+W` (close), `Ctrl+Shift+D` (split right), `Ctrl+Shift+E` (split down), `Ctrl+Tab` (cycle groups), `Alt+Arrow` (navigate panes)
- Sidebar styling (hover, active indicator, dead terminal)
- Focused pane border highlight
- Edge cases: last group creates default, window title tracks active terminal
- **Verify**: Full keyboard-driven workflow, polish feels right

### Phase 6: Extensibility Hooks (Future-proofing)
- `config.ts` with typed config interface (shell, font, theme, opacity) — defaults only
- Zustand `persist` middleware scaffold (disabled, for future session persistence)
- CSS custom properties scaffold for future theming

---

## Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| node-pty production packaging | `asarUnpack` for node-pty native files in electron-builder config |
| Resize flood during split drag | Debounce `resizePty` (50-100ms), batch `fitAddon.fit()` |
| Memory with many terminals | Default scrollback limit (5000 lines) |
| Focus management | Use xterm's `terminal.onFocus` event to update store |
| Allotment + xterm sizing | Explicit `width/height: 100%` on container, `requestAnimationFrame` before fit |

---

## Verification Plan

After each phase, verify by:
1. `npm run dev` — app launches without errors
2. Phase-specific manual testing (described in each phase above)
3. Check DevTools console for IPC errors or xterm warnings
4. Verify no orphaned PTY processes after closing terminals (Task Manager check)

---

## Critical Files

- `src/main/pty-manager.ts` — PTY lifecycle, the bridge between node-pty and IPC
- `src/renderer/store/terminal-store.ts` — All terminal/group/split state + actions
- `src/renderer/components/SplitPane/SplitContainer.tsx` — Recursive split tree renderer
- `src/renderer/components/Terminal/TerminalPane.tsx` — Title bar + terminal wrapper for each split pane
- `src/renderer/components/Terminal/TerminalInstance.tsx` — xterm.js lifecycle + IPC piping
- `src/preload/index.ts` — Typed contract between main and renderer
- `src/renderer/lib/tree-utils.ts` — Split tree manipulation helpers
