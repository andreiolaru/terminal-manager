import type { TerminalConfig } from './config'
import { defaultConfig } from './config'

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
  root.style.setProperty('--tm-hover-bg', t.hoverBackground)
  root.style.setProperty('--tm-list-hover-bg', t.listHoverBackground)
  root.style.setProperty('--tm-list-active-bg', t.listActiveBackground)
  root.style.setProperty('--tm-tab-hover-bg', t.tabHoverBackground)
  root.style.setProperty('--tm-scrollbar-thumb', t.scrollbarThumb)
  root.style.setProperty('--tm-scrollbar-thumb-hover', t.scrollbarThumbHover)
}
