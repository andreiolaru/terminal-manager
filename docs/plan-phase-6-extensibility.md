# Phase 6: Extensibility Hooks (Config, Theming, Persistence Scaffold)

## Context

Phases 1-5 are complete: the terminal manager is fully functional with multi-terminal, split panes, groups/tabs, keyboard shortcuts, and visual polish. Phase 6 adds the extensibility scaffolding that makes the app configurable and ready for future theming/session persistence without over-engineering.

---

## Goals

1. **Typed config system** — centralize all hardcoded values (shell, font, theme colors, scrollback, opacity) into a single config module with a typed interface and sensible defaults
2. **CSS custom properties** — extract all hardcoded colors from CSS into `:root` variables, making future theming a matter of swapping variable values
3. **xterm theme from config** — wire the xterm `theme` option to pull from config rather than inline object
4. **Zustand persist scaffold** — add the `persist` middleware to the store (disabled/no-op by default), so future session save/restore is a one-line toggle

---

## Architecture Decisions

### Config System: Simple Module, No Runtime UI

Phase 6 is about scaffolding, not building a settings UI. The config module exports a typed default config object. Components import and use it. A future phase can add a settings panel or file-based config loading — the typed interface is the contract.

Config lives at `src/renderer/lib/config.ts` (renderer-only for now). The main process gets relevant config values via IPC if needed in the future, but currently the only main-process configurable is the default shell, which is already passed via `pty:create`.

### CSS Custom Properties: Systematic Extraction

All hardcoded hex colors across the 5 CSS files get extracted into `:root` CSS variables in `global.css`. Component CSS files reference variables. This is a mechanical refactor — no visual changes.

### Persist Middleware: Disabled Scaffold

Zustand's `persist` middleware wraps the store but uses a custom `storage` that does nothing (read returns `undefined`, write is a no-op). This proves the middleware wiring works without actually persisting anything. To enable persistence later, swap in `localStorage` or an Electron `electron-store` adapter.

---

## Implementation Steps

### Step 1: Config Interface & Defaults (`src/renderer/lib/config.ts` — NEW)

**New file** with typed config:

```typescript
export interface TerminalConfig {
  shell: {
    default: string
    // Future: profiles, args, env overrides
  }
  font: {
    family: string
    size: number
  }
  scrollback: number
  theme: {
    // Terminal emulator colors
    background: string
    foreground: string
    cursor: string
    selectionBackground: string
    // UI chrome colors
    sidebarBackground: string
    panelBackground: string
    titleBarBackground: string
    tabBarBackground: string
    tabActiveBackground: string
    tabInactiveBackground: string
    border: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    accentColor: string
    dangerColor: string
    // Scrollbar
    scrollbarThumb: string
    scrollbarThumbHover: string
  }
  window: {
    opacity: number // 0.0-1.0, for future transparency support
  }
}

export const defaultConfig: TerminalConfig = {
  shell: {
    default: 'powershell.exe'
  },
  font: {
    family: "'Cascadia Code', 'Consolas', monospace",
    size: 14
  },
  scrollback: 5000,
  theme: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    selectionBackground: '#264f78',
    sidebarBackground: '#252526',
    panelBackground: '#1e1e1e',
    titleBarBackground: '#2d2d2d',
    tabBarBackground: '#252526',
    tabActiveBackground: '#1e1e1e',
    tabInactiveBackground: '#2d2d2d',
    border: '#3c3c3c',
    textPrimary: '#cccccc',
    textSecondary: '#999999',
    textMuted: '#666666',
    accentColor: '#007acc',
    dangerColor: '#b13a3a',
    scrollbarThumb: 'rgba(255, 255, 255, 0.15)',
    scrollbarThumbHover: 'rgba(255, 255, 255, 0.25)'
  },
  window: {
    opacity: 1.0
  }
}
```

Then update `constants.ts` to import from config:

```typescript
import { defaultConfig } from './config'

export const DEFAULT_SHELL = defaultConfig.shell.default
export const DEFAULT_SCROLLBACK = defaultConfig.scrollback
export const RESIZE_DEBOUNCE_MS = 75
```

This way existing code that imports from `constants.ts` continues to work, but the source of truth is now `config.ts`.

### Step 2: CSS Custom Properties (`src/renderer/assets/styles/global.css`)

Add comprehensive `:root` block mapping all theme colors to CSS variables:

```css
:root {
  /* Terminal */
  --tm-background: #1e1e1e;
  --tm-foreground: #cccccc;
  --tm-cursor: #ffffff;
  --tm-selection: #264f78;

  /* UI Chrome */
  --tm-sidebar-bg: #252526;
  --tm-panel-bg: #1e1e1e;
  --tm-titlebar-bg: #2d2d2d;
  --tm-tabbar-bg: #252526;
  --tm-tab-active-bg: #1e1e1e;
  --tm-tab-inactive-bg: #2d2d2d;
  --tm-border: #3c3c3c;

  /* Text */
  --tm-text-primary: #cccccc;
  --tm-text-secondary: #999999;
  --tm-text-muted: #666666;

  /* Accents */
  --tm-accent: #007acc;
  --tm-danger: #b13a3a;

  /* Interactive */
  --tm-hover-bg: #3c3c3c;
  --tm-list-hover-bg: #2a2d2e;
  --tm-list-active-bg: #37373d;
  --tm-tab-hover-bg: #333333;

  /* Scrollbar */
  --tm-scrollbar-thumb: rgba(255, 255, 255, 0.15);
  --tm-scrollbar-thumb-hover: rgba(255, 255, 255, 0.25);

  /* Allotment overrides */
  --focus-border: var(--tm-accent);
  --sash-size: 6px;
  --sash-hover-size: 3px;
}
```

### Step 3: CSS Migration — Replace Hardcoded Colors

Systematic find-and-replace across all CSS files. No visual changes, just variable references.

**`global.css`:**
- `background: #1e1e1e` → `background: var(--tm-background)`
- `color: #cccccc` → `color: var(--tm-foreground)`
- `::selection` background/color → variables

**`sidebar.css`:**
- All `#252526`, `#3c3c3c`, `#cccccc`, `#bbbbbb`, `#2a2d2e`, `#37373d`, `#007acc`, `#b13a3a` → corresponding variables

**`tabs.css`:**
- All hardcoded colors → variables

**`splitpane.css`:**
- All hardcoded colors → variables

**`terminal.css`:**
- All hardcoded colors → variables

### Step 4: Wire xterm Theme to Config

In `TerminalInstance.tsx`, replace the inline theme object:

```typescript
// Before
theme: {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#ffffff'
}

// After
import { defaultConfig } from '../../lib/config'
// ...
theme: {
  background: defaultConfig.theme.background,
  foreground: defaultConfig.theme.foreground,
  cursor: defaultConfig.theme.cursor,
  selectionBackground: defaultConfig.theme.selectionBackground
}
```

Also wire `fontSize`, `fontFamily`, and `scrollback` from config.

### Step 5: CSS Variable Injection from Config (Bridge)

Add a small utility `src/renderer/lib/apply-theme.ts` that writes config theme values to CSS custom properties at runtime. This bridges the TypeScript config to the CSS variable system:

```typescript
import { defaultConfig, TerminalConfig } from './config'

export function applyTheme(config: TerminalConfig = defaultConfig): void {
  const root = document.documentElement
  const t = config.theme

  root.style.setProperty('--tm-background', t.background)
  root.style.setProperty('--tm-foreground', t.foreground)
  root.style.setProperty('--tm-cursor', t.cursor)
  root.style.setProperty('--tm-selection', t.selectionBackground)
  root.style.setProperty('--tm-sidebar-bg', t.sidebarBackground)
  root.style.setProperty('--tm-panel-bg', t.panelBackground)
  root.style.setProperty('--tm-titlebar-bg', t.titleBarBackground)
  root.style.setProperty('--tm-tabbar-bg', t.tabBarBackground)
  root.style.setProperty('--tm-tab-active-bg', t.tabActiveBackground)
  root.style.setProperty('--tm-tab-inactive-bg', t.tabInactiveBackground)
  root.style.setProperty('--tm-border', t.border)
  root.style.setProperty('--tm-text-primary', t.textPrimary)
  root.style.setProperty('--tm-text-secondary', t.textSecondary)
  root.style.setProperty('--tm-text-muted', t.textMuted)
  root.style.setProperty('--tm-accent', t.accentColor)
  root.style.setProperty('--tm-danger', t.dangerColor)
  root.style.setProperty('--tm-scrollbar-thumb', t.scrollbarThumb)
  root.style.setProperty('--tm-scrollbar-thumb-hover', t.scrollbarThumbHover)
}
```

Call `applyTheme()` once at app startup in `main.tsx`, before React renders. The CSS `:root` defaults in `global.css` act as fallbacks if `applyTheme` hasn't run yet (SSR safety / flash prevention).

### Step 6: Zustand Persist Scaffold

Update `terminal-store.ts` to wrap with `persist` middleware (disabled):

```typescript
import { persist, createJSONStorage } from 'zustand/middleware'

// No-op storage — scaffold for future session persistence
const noopStorage = createJSONStorage(() => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}))

export const useTerminalStore = create<TerminalState>()(
  persist(
    immer((set) => ({
      // ... existing store unchanged ...
    })),
    {
      name: 'terminal-manager-state',
      storage: noopStorage,
      // Only persist layout, not terminal instances (they need live PTYs)
      partialize: (state) => ({
        nextTerminalNumber: state.nextTerminalNumber,
        nextGroupNumber: state.nextGroupNumber
        // Future: groups layout, window positions, etc.
      })
    }
  )
)
```

The `partialize` function documents what would be persisted — just counters for now, with comments indicating future expansion points.

### Step 7: Window Opacity Scaffold

In `src/main/index.ts`, add scaffold for window opacity from config:

- The `BrowserWindow` already has `frame: true`. Add a comment showing where `opacity` would be wired from config.
- No actual IPC needed yet — this is a main-process concern that would read from a config file in a future phase.

---

## Files Summary

| File | Type | Changes |
|------|------|---------|
| `src/renderer/lib/config.ts` | **New** | `TerminalConfig` interface + `defaultConfig` object |
| `src/renderer/lib/apply-theme.ts` | **New** | `applyTheme()` — bridges config to CSS variables |
| `src/renderer/lib/constants.ts` | Edit | Import defaults from config instead of hardcoding |
| `src/renderer/main.tsx` | Edit | Call `applyTheme()` at startup |
| `src/renderer/assets/styles/global.css` | Edit | Add `:root` CSS variables, replace hardcoded colors |
| `src/renderer/assets/styles/sidebar.css` | Edit | Replace hardcoded colors with variables |
| `src/renderer/assets/styles/tabs.css` | Edit | Replace hardcoded colors with variables |
| `src/renderer/assets/styles/splitpane.css` | Edit | Replace hardcoded colors with variables |
| `src/renderer/assets/styles/terminal.css` | Edit | Replace hardcoded colors with variables |
| `src/renderer/components/Terminal/TerminalInstance.tsx` | Edit | Wire theme/font/scrollback from config |
| `src/renderer/store/terminal-store.ts` | Edit | Add persist middleware scaffold (noop storage) |

---

## What This Does NOT Include (Intentionally)

- **No settings UI** — that's a future phase (settings panel, config file loading)
- **No theme switching at runtime** — the scaffold supports it (call `applyTheme(newConfig)`) but there's no UI trigger
- **No config file on disk** — defaults are in-code; file-based config is a future concern
- **No actual session persistence** — the persist middleware is wired but uses noop storage
- **No window transparency** — opacity is in the config interface but not wired to BrowserWindow yet

---

## Verification

1. `npm run dev` — app launches, looks identical to before (no visual regression)
2. Inspect `:root` in DevTools — all `--tm-*` variables are present
3. In DevTools console, manually test theming: `document.documentElement.style.setProperty('--tm-accent', '#ff0000')` — accent color changes everywhere instantly
4. Verify xterm terminal colors still match (background, foreground, cursor)
5. `npx vitest run` — all existing tests pass
6. Check that `config.ts` types are strict (no implicit `any`)
7. Verify constants.ts still exports the same values (no behavior change)
