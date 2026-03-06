---
description: Activate Electron architecture expertise for main process, IPC, security, and native module work
---

You are now operating with deep Electron expertise, specifically tuned to this terminal-manager project.

## Project Architecture

- **Electron 35** with electron-vite 3 (main/preload/renderer)
- **node-pty 1.0** native module requiring `@electron/rebuild`
- **electron-builder** for packaging (dir target, `asarUnpack` for node-pty)

## Process Boundaries (enforce strictly)

- **Main** (`src/main/`): node-pty lifecycle, IPC handlers, app lifecycle, window management. All Node.js APIs here.
- **Preload** (`src/preload/`): contextBridge only. Typed `electronAPI` exposure. Minimal code.
- **Renderer** (`src/renderer/`): React UI, xterm.js, Zustand store. Zero Node.js APIs.
- `contextIsolation: true` and `nodeIntegration: false` are non-negotiable.

## IPC Patterns (this project's conventions)

| Channel | Pattern | Why |
|---------|---------|-----|
| `pty:create` | invoke/handle | Awaitable, need error feedback |
| `pty:write` | send/on | Fire-and-forget, max throughput |
| `pty:data` | webContents.send | High-frequency push to renderer |
| `pty:resize` | send/on | Fire-and-forget |
| `pty:destroy` | invoke/handle | Awaitable, cleanup confirmation |
| `pty:exit` | webContents.send | Push notification |

Channel names and payload types are defined in `src/shared/ipc-types.ts` — always use the `IPC_CHANNELS` constants.

## Security Checklist

- CSP configured in `src/main/index.ts` (relaxed in dev for HMR)
- Navigation prevention via `will-navigate` + `setWindowOpenHandler`
- Permission denial via `setPermissionRequestHandler`
- Shell allowlist in `src/main/ipc-handlers.ts` (case-insensitive)
- CWD validation via `existsSync`
- Cols/rows validation (reject 0, negative, NaN)

## Native Module Notes

- node-pty requires compilation against Electron's Node.js version
- `@electron/rebuild` runs in postinstall
- electron-builder config: `asarUnpack: ["node_modules/node-pty/**"]`
- `externalizeDepsPlugin` in electron-vite config

## Common Pitfalls

- Never put node-pty or Node.js APIs in renderer code
- PtyManager removes from map BEFORE kill to suppress onExit handler
- `destroyAll` clears map first, then kills — order matters
- `sandbox: false` required because preload uses `require()` for electron modules

When reviewing or writing code, enforce these boundaries and patterns strictly.
