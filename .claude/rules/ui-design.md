---
paths:
  - "src/renderer/assets/styles/**"
  - "**/*.css"
---

# UI Design Rules

## Design Language (VS Code integrated terminal style)

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

## Component Styling Reference

- Tab bar: 30px height, #252526 bg, active tab has 2px #007acc bottom border
- Inactive tabs: `border-bottom: 2px solid transparent` (prevents layout shift)
- Terminal pane title bar: 24px, #2d2d2d bg, active pane has 2px #007acc left border
- Action buttons: hidden until hover or `:focus-within`, shown with `:focus-visible` outline
- Dead terminals: italic + 50% opacity on title
- Allotment: `minSize={50}`, containers need explicit `width/height: 100%`

## Accessibility Standards

- All interactive elements need `:focus-visible` styles
- Buttons need `aria-label` attributes
- Tab bar uses `role="tablist"`, `role="tab"`, `aria-selected`
- Contrast: WCAG AA minimum (#999 on #2d2d2d is borderline)

## Phase 6 Theming Prep

When extracting CSS custom properties, use: `--bg-primary/secondary/tertiary`, `--text-primary/secondary/disabled`, `--accent`, `--border`, `--destructive`
