import type { BackgroundGradient } from '../../shared/template-types'

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function normalizeHex(hex: string): string | null {
  if (!HEX_COLOR_RE.test(hex)) return null
  const cleaned = hex.slice(1)
  if (cleaned.length === 3) {
    return cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2]
  }
  return cleaned
}

export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = normalizeHex(hex)
  if (!cleaned) return 'transparent'
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function buildGradient(gradient: BackgroundGradient): string {
  const angle = Number.isFinite(gradient.angle) ? gradient.angle! : 135
  const from = HEX_COLOR_RE.test(gradient.from) ? gradient.from : '#1e1e1e'
  const to = HEX_COLOR_RE.test(gradient.to) ? gradient.to : '#1e1e1e'
  return `linear-gradient(${angle}deg, ${from}, ${to})`
}
