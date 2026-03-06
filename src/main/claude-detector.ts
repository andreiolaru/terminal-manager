type ClaudeCodeStatus = 'idle' | 'working' | 'needs-input' | 'completed'

export type StatusChangeCallback = (
  id: string,
  status: ClaudeCodeStatus,
  contextTitle?: string
) => void

export type InfoChangeCallback = (
  id: string,
  model: string | undefined,
  context: string | undefined
) => void

interface TerminalState {
  status: ClaudeCodeStatus
  buffer: string
  silenceTimer: ReturnType<typeof setTimeout> | null
  workingSilenceTimer: ReturnType<typeof setTimeout> | null
  lastDataTime: number
  lastTitle: string
  model: string
  context: string
}

// Braille spinner characters used by Claude Code (U+2800..U+28FF block)
const BRAILLE_RANGE_START = 0x2800
const BRAILLE_RANGE_END = 0x28FF

// Input box border characters (Unicode box-drawing)
const INPUT_BOX_CHARS = /[\u2500-\u257F\u256D-\u2570\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C]/

// Text patterns that indicate Claude is waiting for user input
const INPUT_PROMPT_PATTERNS = /\(y\)es|\(n\)o|\(a\)lways|Allow |Deny |yes\/no|approve/i

const BUFFER_MAX = 2048
const NEEDS_INPUT_SILENCE_MS = 500
const COMPLETED_TO_IDLE_MS = 5000
const WORKING_SILENCE_MS = 2000

// Model: "Opus 4.6", "claude-opus-4-6", "sonnet", etc.
const MODEL_RE = /\b(?:claude[-_ ]?)?(opus|sonnet|haiku)(?:[-_ ]*(\d+(?:\.\d+)?(?:[-_.]\d+)?))?/i
// Context: "Ctx: 34%" or "Ctx: 34.5%"
const CTX_RE = /Ctx:\s*(\d+(?:\.\d+)?)\s*%/i
// Token usage fallback: "45k / 200k", "45.2k/200k"
const TOKENS_RE = /\b(\d+(?:\.\d+)?)\s*k\s*[/\u2502|]\s*(\d+(?:\.\d+)?)\s*k\b/

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

function hasBrailleSpinner(text: string): boolean {
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code >= BRAILLE_RANGE_START && code <= BRAILLE_RANGE_END && code !== BRAILLE_RANGE_START) {
      return true
    }
  }
  return false
}

// Claude Code sets OSC title to "✻ <activity>" (U+273B) or "* <activity>" when working
function titleIndicatesWorking(title: string): boolean {
  return title.startsWith('\u273B') || title.startsWith('* ') || hasBrailleSpinner(title)
}

function hasInputBoxChars(text: string): boolean {
  return INPUT_BOX_CHARS.test(text)
}

function hasInputPrompt(text: string): boolean {
  return INPUT_PROMPT_PATTERNS.test(text)
}

export class ClaudeCodeDetector {
  private states = new Map<string, TerminalState>()
  onStatusChange: StatusChangeCallback = () => {}
  onInfoChange: InfoChangeCallback = () => {}

  register(id: string): void {
    this.states.set(id, {
      status: 'idle',
      buffer: '',
      silenceTimer: null,
      workingSilenceTimer: null,
      lastDataTime: 0,
      lastTitle: '',
      model: '',
      context: ''
    })
    this.onStatusChange(id, 'idle')
  }

  unregister(id: string): void {
    const state = this.states.get(id)
    if (state) {
      if (state.silenceTimer) clearTimeout(state.silenceTimer)
      if (state.workingSilenceTimer) clearTimeout(state.workingSilenceTimer)
    }
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
      const wasWorking = titleIndicatesWorking(state.lastTitle)
      state.lastTitle = osc.title

      if (titleIndicatesWorking(osc.title)) {
        this.transition(id, state, 'working')
      } else if (wasWorking && state.status === 'working') {
        // Title dropped the working indicator — Claude finished, waiting for next input
        this.transition(id, state, 'idle')
      }
    }

    if (osc.notifications.length > 0) {
      const contextTitle = osc.notifications[osc.notifications.length - 1]
      this.transition(id, state, 'completed', contextTitle)
      this.scheduleIdleTransition(id, state)
      return
    }

    // Phase 2: text pattern matching on stripped output
    const cleaned = stripAnsi(rawData)
    state.buffer += cleaned
    if (state.buffer.length > BUFFER_MAX) {
      state.buffer = state.buffer.slice(-BUFFER_MAX)
    }

    // Braille spinner in output text (Claude Code renders spinners inline)
    if (hasBrailleSpinner(cleaned)) {
      this.transition(id, state, 'working')
    }

    // Input box / prompt detection: works from any state except needs-input
    if (state.status !== 'needs-input') {
      if (hasInputBoxChars(cleaned) || hasInputPrompt(state.buffer)) {
        this.scheduleSilenceCheck(id, state)
      }
    }

    // Extract model/context info from status bar text
    this.extractInfo(id, state, cleaned)

    // When working, schedule idle transition on output silence
    if (state.status === 'working') {
      this.scheduleWorkingSilence(id, state)
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
    if (state.workingSilenceTimer) {
      clearTimeout(state.workingSilenceTimer)
      state.workingSilenceTimer = null
    }
    state.status = newStatus
    this.onStatusChange(id, newStatus, contextTitle)
  }

  private scheduleSilenceCheck(id: string, state: TerminalState): void {
    if (state.silenceTimer) clearTimeout(state.silenceTimer)
    state.silenceTimer = setTimeout(() => {
      state.silenceTimer = null
      const elapsed = Date.now() - state.lastDataTime
      if (elapsed >= NEEDS_INPUT_SILENCE_MS - 50 && state.status !== 'needs-input' && state.status !== 'completed') {
        this.transition(id, state, 'needs-input')
      }
    }, NEEDS_INPUT_SILENCE_MS)
  }

  private scheduleWorkingSilence(id: string, state: TerminalState): void {
    if (state.workingSilenceTimer) clearTimeout(state.workingSilenceTimer)
    state.workingSilenceTimer = setTimeout(() => {
      state.workingSilenceTimer = null
      if (state.status === 'working') {
        this.transition(id, state, 'idle')
      }
    }, WORKING_SILENCE_MS)
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

  private extractInfo(id: string, state: TerminalState, text: string): void {
    let changed = false

    const modelMatch = text.match(MODEL_RE)
    if (modelMatch) {
      const family = modelMatch[1].charAt(0).toUpperCase() + modelMatch[1].slice(1).toLowerCase()
      const version = modelMatch[2] ? ` ${modelMatch[2].replace(/[-_]/g, '.')}` : ''
      const model = `${family}${version}`
      if (model !== state.model) {
        state.model = model
        changed = true
      }
    }

    const ctxMatch = text.match(CTX_RE)
    if (ctxMatch) {
      const context = `${ctxMatch[1]}%`
      if (context !== state.context) {
        state.context = context
        changed = true
      }
    } else {
      const tokenMatch = text.match(TOKENS_RE)
      if (tokenMatch) {
        const context = `${tokenMatch[1]}k/${tokenMatch[2]}k`
        if (context !== state.context) {
          state.context = context
          changed = true
        }
      }
    }

    if (changed) {
      this.onInfoChange(id, state.model || undefined, state.context || undefined)
    }
  }

  destroy(): void {
    for (const [, state] of this.states) {
      if (state.silenceTimer) clearTimeout(state.silenceTimer)
      if (state.workingSilenceTimer) clearTimeout(state.workingSilenceTimer)
    }
    this.states.clear()
  }
}
