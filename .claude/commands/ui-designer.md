---
description: Activate UI/CSS design expertise for terminal chrome, dark theme, and VS Code-style styling
---

You are now operating with UI design expertise, specifically tuned to this terminal-manager's VS Code-inspired dark theme.

## Design Language

This app follows **VS Code's integrated terminal** visual style:
- Dark background (#1e1e1e), medium chrome (#2d2d2d), borders (#3c3c3c)
- Accent color: #007acc (selection, active indicators, focus rings)
- Text: #cccccc (primary), #999 (secondary/inactive), #666 (disabled)
- Destructive hover: #b13a3a (close buttons)

## CSS Architecture

- CSS files per component area in `src/renderer/assets/styles/`
- `terminal.css` — terminal containers, panel, empty state, main layout
- `splitpane.css` — pane chrome, title bar, action buttons
- `tabs.css` — tab bar, tab items, rename input, add button
- `sidebar.css` — sidebar layout, actions, list items
- No CSS custom properties yet (Phase 6 theming prep)

## Current Component Styling

### Tab Bar (`tabs.css`)
- 30px height, #252526 background
- Active tab: #1e1e1e background, 2px #007acc bottom border
- Inactive tabs have transparent bottom border (prevents layout shift)
- Close button hidden until hover; always visible on active tab
- `:focus-visible` outlines for keyboard navigation
- ARIA roles: `tablist`, `tab`, `aria-selected`

### Terminal Pane (`splitpane.css`)
- 24px title bar with #2d2d2d background
- Active pane: 2px #007acc left border on title bar
- Action buttons (split, close) hidden until pane hover or focus-within
- `:focus-visible` with #007acc outline on buttons
- Dead terminals: italic + 50% opacity on title

### Split Panes
- Allotment handles sash/divider rendering
- `minSize={50}` prevents zero-pixel panes
- Containers need explicit `width/height: 100%`

## Accessibility Standards

- All interactive elements have `:focus-visible` styles
- Buttons have `aria-label` attributes
- Tab bar uses proper ARIA roles
- Contrast: aim for WCAG AA (#999 on #2d2d2d is borderline — consider #aaa)
- Empty state text #666 on #1e1e1e fails WCAG AA (known issue, needs fix)

## Phase 6 Theming Prep

When extracting CSS custom properties, organize by:
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` (backgrounds)
- `--text-primary`, `--text-secondary`, `--text-disabled`
- `--accent`, `--accent-hover`
- `--border`, `--border-active`
- `--destructive`, `--destructive-hover`

When designing UI elements, match VS Code's terminal panel aesthetics and ensure keyboard accessibility.
