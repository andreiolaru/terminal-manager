type ClaudeCodeStatus = 'idle' | 'working' | 'needs-input' | 'completed'

export type StatusChangeCallback = (
  id: string,
  status: ClaudeCodeStatus,
  contextTitle?: string
) => void

interface TerminalState {
  status: ClaudeCodeStatus
  buffer: string
  silenceTimer: ReturnType<typeof setTimeout> | null
  lastDataTime: number
  lastTitle: string
}

// Braille spinner characters used by Claude Code in OSC title
const BRAILLE_SPINNER = new Set([
  '\u2807', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2847', '\u280F'
])

// Input box border characters (Unicode box-drawing)
const INPUT_BOX_CHARS = /[\u2500-\u257F\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C]/

const BUFFER_MAX = 2048
const NEEDS_INPUT_SILENCE_MS = 500
const COMPLETED_TO_IDLE_MS = 5000

/**
 * Extract OSC signals from raw PTY data before ANSI stripping.
 * Returns any title set via OSC 0/2, and desktop notifications via OSC 9/99/777.
 */
export function extractOscSignals(raw: string): { title?: string; notifications: string[] } {
  const result: { title?: string; notifications: string[] } = { notifications: [] }

  // OSC 0 or OSC 2 (set title): \x1b]0;...\x07 or \x1b]2;...\x07  (also \x1b\\ as ST)
  const titleRe = /\x1b\](?:0|2);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g
  let m: RegExpExecArray | null
  while ((m = titleRe.exec(raw)) !== null) {
    result.title = m[1]
  }

  // OSC 9 (notification): \x1b]9;...\x07
  const osc9Re = /\x1b\]9;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g
  while ((m = osc9Re.exec(raw)) !== null) {
    result.notifications.push(m[1])
  }

  // OSC 99 (notification): \x1b]99;...\x07
  const osc99Re = /\x1b\]99;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g
  while ((m = osc99Re.exec(raw)) !== null) {
    result.notifications.push(m[1])
  }

  // OSC 777 (notification): \x1b]777;...\x07
  const osc777Re = /\x1b\]777;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g
  while ((m = osc777Re.exec(raw)) !== null) {
    result.notifications.push(m[1])
  }

  return result
}

/**
 * Strip ANSI escape sequences (CSI, OSC, charset) from a string.
 */
export function stripAnsi(str: string): string {
  // CSI sequences: \x1b[ ... final byte
  // OSC sequences: \x1b] ... ST
  // Charset: \x1b(, \x1b), \x1b* etc.
  // Simple escapes: \x1b followed by single char
  return str
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')       // CSI
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC
    .replace(/\x1b[()BN012]/g, '')                  // Charset designations
    .replace(/\x1b[78DEHM]/g, '')                   // Simple escape sequences
    .replace(/\x1b/g, '')                           // Any remaining bare ESC
}

function titleHasSpinner(title: string): boolean {
  for (const char of title) {
    if (BRAILLE_SPINNER.has(char)) return true
  }
  return false
}

function hasInputBoxChars(text: string): boolean {
  return INPUT_BOX_CHARS.test(text)
}

export class ClaudeCodeDetector {
  private states = new Map<string, TerminalState>()
  onStatusChange: StatusChangeCallback = () => {}

  register(id: string): void {
    this.states.set(id, {
      status: 'idle',
      buffer: '',
      silenceTimer: null,
      lastDataTime: 0,
      lastTitle: ''
    })
    this.onStatusChange(id, 'idle')
  }

  unregister(id: string): void {
    const state = this.states.get(id)
    if (state?.silenceTimer) clearTimeout(state.silenceTimer)
    this.states.delete(id)
  }

  isRegistered(id: string): boolean {
    return this.states.has(id)
  }

  feed(id: string, rawData: string): void {
    const state = this.states.get(id)
    if (!state) return

    state.lastDataTime = Date.now()

    // Phase 1: OSC extraction (before stripping)
    const osc = extractOscSignals(rawData)

    if (osc.title !== undefined) {
      state.lastTitle = osc.title

      if (titleHasSpinner(osc.title)) {
        this.transition(id, state, 'working')
      }
    }

    if (osc.notifications.length > 0) {
      const contextTitle = osc.notifications[osc.notifications.length - 1]
      this.transition(id, state, 'completed', contextTitle)
      this.scheduleIdleTransition(id, state)
      return
    }

    // Phase 2: text pattern matching
    const cleaned = stripAnsi(rawData)
    state.buffer += cleaned
    if (state.buffer.length > BUFFER_MAX) {
      state.buffer = state.buffer.slice(-BUFFER_MAX)
    }

    // Input box detection: only relevant after working state
    if (state.status === 'working' && hasInputBoxChars(cleaned)) {
      this.scheduleSilenceCheck(id, state)
    }
  }

  onWrite(id: string): void {
    const state = this.states.get(id)
    if (!state) return

    if (state.status === 'needs-input' || state.status === 'completed') {
      this.transition(id, state, 'working')
    }
  }

  private transition(id: string, state: TerminalState, newStatus: ClaudeCodeStatus, contextTitle?: string): void {
    if (state.status === newStatus) return
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer)
      state.silenceTimer = null
    }
    state.status = newStatus
    this.onStatusChange(id, newStatus, contextTitle)
  }

  private scheduleSilenceCheck(id: string, state: TerminalState): void {
    if (state.silenceTimer) clearTimeout(state.silenceTimer)
    state.silenceTimer = setTimeout(() => {
      state.silenceTimer = null
      const elapsed = Date.now() - state.lastDataTime
      if (elapsed >= NEEDS_INPUT_SILENCE_MS - 50 && state.status === 'working') {
        this.transition(id, state, 'needs-input')
      }
    }, NEEDS_INPUT_SILENCE_MS)
  }

  private scheduleIdleTransition(id: string, state: TerminalState): void {
    if (state.silenceTimer) clearTimeout(state.silenceTimer)
    state.silenceTimer = setTimeout(() => {
      state.silenceTimer = null
      if (state.status === 'completed') {
        this.transition(id, state, 'idle')
      }
    }, COMPLETED_TO_IDLE_MS)
  }

  destroy(): void {
    for (const [, state] of this.states) {
      if (state.silenceTimer) clearTimeout(state.silenceTimer)
    }
    this.states.clear()
  }
}
