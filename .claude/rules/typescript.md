---
paths:
  - "src/shared/**"
  - "src/preload/index.d.ts"
  - "tsconfig*.json"
---

# TypeScript Rules

## Project Setup

- TypeScript 5.7+ with strict mode
- Two tsconfig projects: `tsconfig.node.json` (main + preload), `tsconfig.web.json` (renderer)
- Shared types: `src/shared/ipc-types.ts` included by both tsconfigs
- Module resolution: `bundler` mode, ESNext modules
- Zero `any` casts, zero `@ts-ignore` — maintain this standard

## Key Type Patterns

### Discriminated Union (SplitNode)
All tree utilities use exhaustive `assertNever` checks:
`if (tree.type === 'leaf') ... if (tree.type === 'branch') ... return assertNever(tree)`

### Shared IPC Contract
- `src/shared/ipc-types.ts`: `IPC_CHANNELS` const object + `PtyCreateOptions` interface
- Single source of truth for channel names — prevents string drift

### Zustand + Immer Typing
- Curried pattern: `create<TerminalState>()(immer((set) => ({ ... })))`
- State interface in `src/renderer/store/types.ts`

## Cross-Process Type Boundaries

`preload/index.d.ts` declares `window.electronAPI: ElectronAPI` globally. This is the type contract between renderer and preload. The renderer imports types from this declaration; the preload implements them using the shared `PtyCreateOptions` type.

## Conventions

- Use `import type` for type-only imports
- Prefer explicit function return types on store actions and utility functions
- Use `ReturnType<typeof setTimeout>` instead of `NodeJS.Timeout` (cross-platform)
- `as const` on channel name objects and fixed arrays
