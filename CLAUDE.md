# Terminal Manager - Claude Code Instructions

## Project Overview

Personal-use Windows terminal manager (VS Code-style integrated terminal). Electron + React + xterm.js + node-pty. See `prd.md` for full spec.

## Tech Stack

- **Electron 35** with electron-vite 3 (main/preload/renderer architecture)
- **React 19 + TypeScript** (strict mode)
- **@xterm/xterm 5.5** + FitAddon + WebglAddon
- **node-pty 1.0** (native module, needs @electron/rebuild)
- **allotment 1.20** for split panes
- **Zustand 5 + immer** for state
- **electron-builder** for packaging (dir target only)

## Architecture Rules

### Process Boundaries (CRITICAL)
- **Main process** (`src/main/`): node-pty lifecycle, IPC handlers, app lifecycle. NO renderer logic here.
- **Preload** (`src/preload/`): contextBridge only. Exposes typed `electronAPI`. Minimal code.
- **Renderer** (`src/renderer/`): React UI, xterm.js instances, Zustand store. NO Node.js APIs.
- Never use `nodeIntegration: true` or `contextIsolation: false`.

### IPC Patterns
- `pty:create` — invoke/handle (awaitable)
- `pty:write` — send/on (fire-and-forget, max throughput)
- `pty:data` — webContents.send to renderer (high-frequency push)
- `pty:resize` — send/on (fire-and-forget)
- `pty:destroy` — invoke/handle (awaitable, cleanup confirmation)

### State Management
- Single Zustand store at `src/renderer/store/terminal-store.ts`
- Use immer middleware for nested split tree mutations
- Types in `src/renderer/store/types.ts`
- Split layout is a recursive binary tree (`SplitNode = SplitLeaf | SplitBranch`)

### Terminal Instance Lifecycle
- xterm instance in `useRef` — never recreate on re-render
- Hidden terminals use `display: none`, NOT unmount (preserves scrollback)
- Debounce `resizePty` calls (50-100ms) during split drag
- Call `fitAddon.fit()` after layout stabilizes via `requestAnimationFrame`

## Code Conventions

- TypeScript strict mode, no `any` without justification
- Functional React components only, hooks for all logic
- CSS files per component area (in `src/renderer/assets/styles/`)
- UUIDs for terminal IDs
- Tree utilities as pure functions in `src/renderer/lib/tree-utils.ts`

## Project Structure

```
src/
  main/           — Electron main process
    index.ts      — App entry, window creation
    pty-manager.ts — node-pty spawn/write/resize/kill
    ipc-handlers.ts — IPC handler registration
  preload/        — Context bridge
    index.ts      — electronAPI exposure
    index.d.ts    — Type declarations
  renderer/       — React app
    components/   — Sidebar/, Terminal/, SplitPane/, Layout/
    store/        — Zustand store + types
    hooks/        — useTerminal, usePtyIpc
    lib/          — ipc-api, tree-utils, constants
    assets/styles/ — CSS files
```

## Development Phases

Current progress is tracked here. Update as phases complete:

- [x] **Phase 1**: Scaffold + single terminal working
- [x] **Phase 2**: Multiple terminals + sidebar
- [ ] **Phase 3**: Split panes (allotment + recursive tree)
- [ ] **Phase 4**: Terminal groups / tabs
- [ ] **Phase 5**: Polish + keyboard shortcuts
- [ ] **Phase 6**: Extensibility hooks (config, theming scaffold)

## Build & Run

```bash
npm install             # Install deps
npm run postinstall     # Rebuild node-pty for Electron (@electron/rebuild)
npm run dev             # Dev mode with HMR
npm run build           # Production build
```

## Key Commands for Verification

After each phase:
1. `npm run dev` — app launches without errors
2. Check DevTools console for IPC errors or xterm warnings
3. Verify no orphaned PTY processes (Task Manager)

## Native Module Notes

- node-pty requires compilation against Electron's Node.js version
- `@electron/rebuild` must run in postinstall
- electron-builder config needs `asarUnpack: ["node_modules/node-pty/**"]`

## Subagents Available

Use these via the Agent tool for specialized tasks:

| Agent | When to use |
|-------|------------|
| `electron-pro` | Main process architecture, IPC design, security, native module issues |
| `react-specialist` | Component patterns, hooks, performance, state management |
| `typescript-pro` | Complex types, generics, type-level programming |
| `ui-designer` | Visual design, CSS, component styling, dark mode |
| `javascript-pro` | Async patterns, performance optimization, Node.js specifics |
| `powershell-7-expert` | Shell/terminal behavior questions (less likely needed) |

### Delegation Guidelines
- Use `electron-pro` for anything touching main process or preload
- Use `react-specialist` for component architecture decisions
- Use `ui-designer` when building CSS/styling for sidebar, tabs, terminal chrome
- Combine `typescript-pro` + `react-specialist` for complex typed React patterns
- Keep subagent tasks focused — one clear question or implementation task per call

## Common Pitfalls to Avoid

- Don't put node-pty or Node.js APIs in renderer code
- Don't unmount terminal components to "hide" them (kills scrollback)
- Don't skip debouncing resize events (floods PTY, causes visual glitches)
- Don't forget `requestAnimationFrame` before `fitAddon.fit()` after layout changes
- Don't create new xterm instances on re-render (use refs)
- Allotment needs explicit `width/height: 100%` on containers or sizing breaks
