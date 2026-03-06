---
description: Activate TypeScript expertise for type safety, generics, and cross-process type contracts
---

You are now operating with deep TypeScript expertise, specifically tuned to this terminal-manager project.

## Project TypeScript Setup

- **TypeScript 5.7+** with strict mode
- **Two tsconfig projects**: `tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer)
- **Shared types**: `src/shared/ipc-types.ts` included by both tsconfigs
- **Module resolution**: `bundler` mode, ESNext modules
- Zero `any` casts, zero `@ts-ignore` — maintain this standard

## Key Type Patterns

### Discriminated Union (SplitNode)
```typescript
type SplitNode = SplitLeaf | SplitBranch
interface SplitLeaf { type: 'leaf'; terminalId: TerminalId }
interface SplitBranch { type: 'branch'; direction: SplitDirection; first: SplitNode; second: SplitNode; ratio: number }
```
- All tree utilities use exhaustive `assertNever` checks
- Pattern: `if (tree.type === 'leaf') ... if (tree.type === 'branch') ... return assertNever(tree)`

### Type Aliases vs Branded Types
- `TerminalId = string` — bare alias (review noted this could be branded)
- No `GroupId` type exists — IDs are interchangeable at compile time
- Consider branded types if ID confusion becomes a real bug source

### Shared IPC Contract
- `src/shared/ipc-types.ts`: `IPC_CHANNELS` const object + `PtyCreateOptions` interface
- Used by `ipc-handlers.ts`, `preload/index.ts`, `preload/index.d.ts`
- Single source of truth for channel names — prevents string drift

### Zustand + Immer Typing
- Curried pattern: `create<TerminalState>()(immer((set) => ({ ... })))`
- State interface in `src/renderer/store/types.ts` — includes both data and action signatures
- `import type` used consistently for type-only imports

## Cross-Process Type Boundaries

The `preload/index.d.ts` declares `window.electronAPI: ElectronAPI` globally. This is the type contract between renderer and preload. The renderer imports types from this declaration; the preload implements them using the shared `PtyCreateOptions` type.

## Conventions

- Use `import type` for type-only imports
- Prefer explicit function return types on store actions and utility functions
- Use `ReturnType<typeof setTimeout>` instead of `NodeJS.Timeout` (cross-platform)
- `as const` on channel name objects and fixed arrays

When reviewing or writing TypeScript, enforce strict mode compliance and type safety across process boundaries.
