# Terminal Manager

<img width="1919" height="1030" alt="image" src="https://github.com/user-attachments/assets/8afc3283-04d7-40c0-8940-63b2101a86ca" />

<img width="1029" height="835" alt="image" src="https://github.com/user-attachments/assets/bcfe1624-7fb8-4103-98f2-76e1636310c6" />


A VS Code-style integrated terminal manager for Windows and macOS, built with Electron, React, and xterm.js. Run multiple shells in split panes, organize them into tabbed groups, and save layouts as reusable templates.

## Features

- **Split panes** — divide any terminal horizontally or vertically, nested to any depth
- **Terminal groups** — independent tabbed workspaces, each with its own split layout
- **Layout templates** — save and restore multi-terminal configurations with a visual editor (drag to adjust ratios, configure per-pane shell/cwd/startup commands)
- **Clickable file paths** — file references in terminal output (e.g. `src/foo.ts:42`) open in VS Code on click
- **Terminal search** — find text in terminal scrollback (Ctrl+Shift+F)
- **Claude Code integration** — live status detection with indicators, tab badges, and desktop notifications
- **Keyboard-driven** — full set of shortcuts for terminal, pane, and group management
- **WebGL rendering** — hardware-accelerated terminal output via xterm.js
- **Smart copy** — copies wrapped lines as single logical lines

## Quick Start

```bash
pnpm install
pnpm run dev
```

Requires Node.js 18+ and a C++ build toolchain for node-pty:
- **Windows** — Visual Studio Build Tools
- **macOS** — Xcode Command Line Tools (`xcode-select --install`)

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 35 |
| Build | electron-vite 5, vite 7 |
| UI | React 19, TypeScript (strict) |
| Terminal | @xterm/xterm 5.5, FitAddon, WebglAddon, SearchAddon, SerializeAddon, Unicode11Addon, WebLinksAddon |
| PTY | node-pty 1.0 |
| Split panes | allotment 1.20 |
| State | Zustand 5 + immer |
| Tests | Vitest, Testing Library |
| Package manager | pnpm |

## Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Start in development mode with HMR |
| `pnpm run build` | Production build |
| `pnpm run preview` | Preview production build |
| `pnpm run test` | Run all tests (main + renderer) |
| `pnpm run test:main` | Run main process tests only |
| `pnpm run test:renderer` | Run renderer tests only |
| `pnpm run test:watch` | Watch mode for renderer tests |
| `pnpm run rebuild` | Rebuild native modules for Electron |

## Project Structure

```
src/
  shared/           Shared types (IPC channels, payloads, templates)
  main/             Electron main process
    index.ts          App entry, window creation, menus
    pty-manager.ts    node-pty spawn/write/resize/kill
    ipc-handlers.ts   IPC handler registration
    claude-detector.ts  Claude Code status detection
    notification-manager.ts  Desktop notifications
    template-storage.ts  Template persistence
  preload/          Context bridge (electronAPI)
  renderer/         React app
    components/
      Layout/         Main layout shell
      Sidebar/        Terminal list, actions
      Terminal/        Pane, instance, tabs, templates, visual editor, search bar
    store/            Zustand store + types
    hooks/            useTerminal, useShortcuts
    lib/              IPC API, PTY dispatcher, tree utils, file link provider, config
    assets/styles/    CSS files
```

## Architecture

The app follows Electron's process isolation model:

- **Main process** — manages PTY lifecycles, IPC handlers, Claude Code detection, notifications, and the application menu. No renderer logic.
- **Preload** — exposes a typed `electronAPI` via `contextBridge`. Minimal surface area.
- **Renderer** — React UI with xterm.js terminals, Zustand state, and the split pane layout. No Node.js APIs.

`contextIsolation` is always enabled. `nodeIntegration` is always disabled.

The split layout is a recursive binary tree (`SplitNode = SplitLeaf | SplitBranch`), mutated via immer through the Zustand store. Tree operations (split, remove, navigate, collect) are pure functions in `tree-utils.ts`.

## Documentation

- **[User Guide](docs/user-guide.md)** — how to use the app (terminals, groups, splits, templates, shortcuts, Claude Code integration)
- **[PRD](prd.md)** — original product requirements

## License

Personal project. Not published.
