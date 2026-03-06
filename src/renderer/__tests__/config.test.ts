import { describe, it, expect } from 'vitest'
import { defaultConfig, TerminalConfig } from '../lib/config'
import { applyTheme } from '../lib/apply-theme'

describe('defaultConfig', () => {
  it('has all required theme keys as non-empty strings', () => {
    const themeKeys: (keyof TerminalConfig['theme'])[] = [
      'background',
      'foreground',
      'cursor',
      'selectionBackground',
      'sidebarBackground',
      'panelBackground',
      'titleBarBackground',
      'tabBarBackground',
      'tabActiveBackground',
      'tabInactiveBackground',
      'border',
      'textPrimary',
      'textSecondary',
      'textMuted',
      'accentColor',
      'dangerColor',
      'hoverBackground',
      'listHoverBackground',
      'listActiveBackground',
      'tabHoverBackground',
      'scrollbarThumb',
      'scrollbarThumbHover'
    ]

    for (const key of themeKeys) {
      expect(defaultConfig.theme[key], `theme.${key}`).toBeTruthy()
    }
  })

  it('has valid font config', () => {
    expect(defaultConfig.font.family).toBeTruthy()
    expect(defaultConfig.font.size).toBeGreaterThan(0)
  })

  it('has valid scrollback', () => {
    expect(defaultConfig.scrollback).toBeGreaterThan(0)
  })

  it('has valid window opacity', () => {
    expect(defaultConfig.window.opacity).toBeGreaterThanOrEqual(0)
    expect(defaultConfig.window.opacity).toBeLessThanOrEqual(1)
  })
})

describe('applyTheme', () => {
  it('sets all --tm-* CSS custom properties on :root', () => {
    applyTheme(defaultConfig)

    const root = document.documentElement
    expect(root.style.getPropertyValue('--tm-background')).toBe(defaultConfig.theme.background)
    expect(root.style.getPropertyValue('--tm-foreground')).toBe(defaultConfig.theme.foreground)
    expect(root.style.getPropertyValue('--tm-accent')).toBe(defaultConfig.theme.accentColor)
    expect(root.style.getPropertyValue('--tm-border')).toBe(defaultConfig.theme.border)
    expect(root.style.getPropertyValue('--tm-danger')).toBe(defaultConfig.theme.dangerColor)
    expect(root.style.getPropertyValue('--tm-sidebar-bg')).toBe(defaultConfig.theme.sidebarBackground)
    expect(root.style.getPropertyValue('--tm-scrollbar-thumb')).toBe(defaultConfig.theme.scrollbarThumb)
  })

  it('applies a custom config overriding defaults', () => {
    const custom: TerminalConfig = {
      ...defaultConfig,
      theme: { ...defaultConfig.theme, accentColor: '#ff0000', background: '#000000' }
    }

    applyTheme(custom)

    const root = document.documentElement
    expect(root.style.getPropertyValue('--tm-accent')).toBe('#ff0000')
    expect(root.style.getPropertyValue('--tm-background')).toBe('#000000')
  })
})
