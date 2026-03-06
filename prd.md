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
│       │   └── splitpane.css
│       ├── components/
│       │   ├── Sidebar/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── TerminalList.tsx
│       │   │   ├── TerminalListItem.tsx
│       │   │   └── SidebarActions.tsx
│       │   ├── Terminal/
│       │   │   ├── TerminalPanel.tsx
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
  activeGroupId: string;
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
        └── <SplitContainer node={activeGroup.splitTree}>
            // Recursive:
            // leaf  → <TerminalInstance />
            // branch → <Allotment> with two <SplitContainer> children
```

### Split Rendering (recursive)

```tsx
function SplitContainer({ node }: { node: SplitNode }) {
  if (node.type === 'leaf') {
    return <TerminalInstance terminalId={node.terminalId} />;
  }
  return (
    <Allotment vertical={node.direction === 'vertical'}>
      <Allotment.Pane>
        <SplitContainer node={node.first} />
      </Allotment.Pane>
      <Allotment.Pane>
        <SplitContainer node={node.second} />
      </Allotment.Pane>
    </Allotment>
  );
}
```

### Tree Utilities (`lib/tree-utils.ts`)

- **`splitNode(tree, targetId, direction)`** → replaces leaf with branch containing original + new leaf
- **`removeNode(tree, targetId)`** → replaces parent branch with surviving sibling
- **`findNode(tree, targetId)`** → locate a leaf in the tree

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

`node-pty` requires compilation against Electron's Node.js version:
- Use `@electron/rebuild` in postinstall
- `asarUnpack: ["node_modules/node-pty/**"]` in electron-builder config

---

## Implementation Phases

### Phase 1: Scaffold + Single Terminal
- Init project with `npm create electron-vite@latest` (react-ts template)
- Implement `pty-manager.ts`, `ipc-handlers.ts`, preload bridge
- Minimal `TerminalInstance.tsx` wired to IPC
- Rebuild node-pty for Electron
- **Verify**: App launches, PowerShell prompt works, typing & output functional

### Phase 2: Multiple Terminals + Sidebar
- Define types, implement Zustand store (terminals map, CRUD actions)
- Build `MainLayout`, `Sidebar`, `TerminalList`, `TerminalListItem`, `SidebarActions`
- Terminal switching via sidebar (active shown, others `display: none`)
- Add/remove terminals, double-click-to-rename, PTY exit handling
- **Verify**: Create multiple terminals, switch between them, close them

### Phase 3: Split Panes
- Install `allotment`, implement `tree-utils.ts`
- Update store to use `SplitNode` tree per group
- Build recursive `SplitContainer.tsx`
- Split actions (context menu or shortcuts): "Split Right" / "Split Down"
- Wire `FitAddon.fit()` on resize, handle terminal removal from splits
- Focus tracking via `terminal.onFocus`
- **Verify**: Nest H+V splits, resize dividers, remove terminals from splits

### Phase 4: Terminal Groups / Tabs
- Build `TerminalTabs.tsx`, update store with `groups` array
- Each group has independent `splitTree` and `activeTerminalId`
- Group switching preserves terminals via CSS hiding
- New Group / Close Group actions
- **Verify**: Multiple groups, independent layouts, switching preserves state

### Phase 5: Polish + Keyboard Shortcuts
- Shortcuts: `Ctrl+Shift+T` (new), `Ctrl+Shift+W` (close), `Ctrl+Shift+D` (split right), `Ctrl+Shift+E` (split down), `Ctrl+Tab` (cycle groups), `Alt+Arrow` (navigate panes)
- Sidebar styling (hover, active indicator, dead terminal)
- Focused pane border highlight
- Edge cases: last terminal closes group, last group creates default, window title tracks active terminal
- **Verify**: Full keyboard-driven workflow, polish feels right

### Phase 6: Extensibility Hooks (Future-proofing)
- `config.ts` with typed config interface (shell, font, theme, opacity) — defaults only
- Zustand `persist` middleware scaffold (disabled, for future session persistence)
- CSS custom properties scaffold for future theming

---

## Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| node-pty native module rebuild | `@electron/rebuild` in postinstall, `asarUnpack` for node-pty |
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
- `src/renderer/components/Terminal/TerminalInstance.tsx` — xterm.js lifecycle + IPC piping
- `src/preload/index.ts` — Typed contract between main and renderer
- `src/renderer/lib/tree-utils.ts` — Split tree manipulation helpers
