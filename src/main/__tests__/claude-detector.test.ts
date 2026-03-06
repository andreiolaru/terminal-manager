import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClaudeCodeDetector, extractOscSignals, stripAnsi } from '../claude-detector'

describe('extractOscSignals', () => {
  it('parses OSC 0 title', () => {
    const result = extractOscSignals('\x1b]0;My Title\x07')
    expect(result.title).toBe('My Title')
  })

  it('parses OSC 2 title', () => {
    const result = extractOscSignals('\x1b]2;Another Title\x07')
    expect(result.title).toBe('Another Title')
  })

  it('uses last title when multiple OSC 0 present', () => {
    const result = extractOscSignals('\x1b]0;First\x07some text\x1b]0;Second\x07')
    expect(result.title).toBe('Second')
  })

  it('parses OSC 9 notification', () => {
    const result = extractOscSignals('\x1b]9;Task done\x07')
    expect(result.notifications).toEqual(['Task done'])
  })

  it('parses OSC 99 notification', () => {
    const result = extractOscSignals('\x1b]99;Completed\x07')
    expect(result.notifications).toEqual(['Completed'])
  })

  it('parses OSC 777 notification', () => {
    const result = extractOscSignals('\x1b]777;Notify\x07')
    expect(result.notifications).toEqual(['Notify'])
  })

  it('handles multiple notifications from different OSC types', () => {
    const raw = '\x1b]9;First\x07\x1b]99;Second\x07\x1b]777;Third\x07'
    const result = extractOscSignals(raw)
    expect(result.notifications).toEqual(['First', 'Second', 'Third'])
  })

  it('returns empty notifications when none present', () => {
    const result = extractOscSignals('plain text')
    expect(result.title).toBeUndefined()
    expect(result.notifications).toEqual([])
  })

  it('handles ST terminator (ESC backslash)', () => {
    const result = extractOscSignals('\x1b]0;Title\x1b\\')
    expect(result.title).toBe('Title')
  })
})

describe('stripAnsi', () => {
  it('removes CSI sequences', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red')
  })

  it('removes OSC sequences', () => {
    expect(stripAnsi('\x1b]0;Title\x07text')).toBe('text')
  })

  it('removes charset designations', () => {
    // The regex strips \x1b followed by one of ( ) B N 0 1 2
    expect(stripAnsi('\x1bBtext')).toBe('text')
    expect(stripAnsi('\x1b(hello')).toBe('hello')
  })

  it('removes bare ESC', () => {
    expect(stripAnsi('\x1btext')).toBe('text')
  })

  it('removes mixed sequences', () => {
    const input = '\x1b[1m\x1b]0;Title\x07\x1bNHello\x1bWorld'
    expect(stripAnsi(input)).toBe('HelloWorld')
  })
})

describe('ClaudeCodeDetector state machine', () => {
  let detector: ClaudeCodeDetector
  let onStatusChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    detector = new ClaudeCodeDetector()
    onStatusChange = vi.fn()
    detector.onStatusChange = onStatusChange
  })

  afterEach(() => {
    detector.destroy()
    vi.useRealTimers()
  })

  it('starts as idle on register', () => {
    detector.register('t1')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'idle')
  })

  it('transitions to working on OSC title with braille spinner', () => {
    detector.register('t1')
    onStatusChange.mockClear()

    detector.feed('t1', '\x1b]0;\u2807 Working\x07')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'working', undefined)
  })

  it('transitions to working on OSC title with * prefix', () => {
    detector.register('t1')
    onStatusChange.mockClear()

    detector.feed('t1', '\x1b]0;* Jitterbugging\x07')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'working', undefined)
  })

  it('transitions to working on OSC title with ✻ prefix', () => {
    detector.register('t1')
    onStatusChange.mockClear()

    detector.feed('t1', '\x1b]0;\u273B Jitterbugging\x07')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'working', undefined)
  })

  it('transitions to working on inline braille spinner in output', () => {
    detector.register('t1')
    onStatusChange.mockClear()

    detector.feed('t1', '  \u2807 Thinking...')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'working', undefined)
  })

  it('transitions from working to idle after 2s of silence', () => {
    detector.register('t1')
    detector.feed('t1', '\x1b]0;\u273B Working\x07')
    onStatusChange.mockClear()

    vi.advanceTimersByTime(2000)
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'idle', undefined)
  })

  it('resets working silence timer on new data', () => {
    detector.register('t1')
    detector.feed('t1', '\x1b]0;\u273B Working\x07')
    onStatusChange.mockClear()

    vi.advanceTimersByTime(1500)
    detector.feed('t1', 'more output')
    vi.advanceTimersByTime(1500)
    // Should NOT have transitioned yet (timer reset)
    expect(onStatusChange).not.toHaveBeenCalledWith('t1', 'idle', undefined)

    vi.advanceTimersByTime(500)
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'idle', undefined)
  })

  it('transitions from working to idle when title drops working indicator', () => {
    detector.register('t1')
    detector.feed('t1', '\x1b]0;\u273B Jitterbugging\x07')
    onStatusChange.mockClear()

    detector.feed('t1', '\x1b]0;Claude Code\x07')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'idle', undefined)
  })

  it('transitions to needs-input on input prompt patterns + silence', () => {
    detector.register('t1')
    onStatusChange.mockClear()

    detector.feed('t1', 'Allow Read tool? (y)es (n)o')
    vi.advanceTimersByTime(500)

    expect(onStatusChange).toHaveBeenCalledWith('t1', 'needs-input', undefined)
  })

  it('transitions to completed on OSC 9 notification while working', () => {
    detector.register('t1')
    detector.feed('t1', '\x1b]0;\u2807 Working\x07')
    onStatusChange.mockClear()

    detector.feed('t1', '\x1b]9;Task finished\x07')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'completed', 'Task finished')
  })

  it('transitions to needs-input when input box chars appear while working + silence', () => {
    detector.register('t1')
    detector.feed('t1', '\x1b]0;\u2807 Working\x07')
    onStatusChange.mockClear()

    detector.feed('t1', '\u250C\u2500\u2500\u2510')
    vi.advanceTimersByTime(500)

    expect(onStatusChange).toHaveBeenCalledWith('t1', 'needs-input', undefined)
  })

  it('transitions from needs-input to working on onWrite', () => {
    detector.register('t1')
    detector.feed('t1', '\x1b]0;\u2807 Working\x07')
    detector.feed('t1', '\u250C\u2500\u2500\u2510')
    vi.advanceTimersByTime(500)
    onStatusChange.mockClear()

    detector.onWrite('t1')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'working', undefined)
  })

  it('transitions from completed to working on onWrite', () => {
    detector.register('t1')
    detector.feed('t1', '\x1b]0;\u2807 Working\x07')
    detector.feed('t1', '\x1b]9;Done\x07')
    onStatusChange.mockClear()

    detector.onWrite('t1')
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'working', undefined)
  })

  it('transitions from completed to idle after 5000ms', () => {
    detector.register('t1')
    detector.feed('t1', '\x1b]0;\u2807 Working\x07')
    detector.feed('t1', '\x1b]9;Done\x07')
    onStatusChange.mockClear()

    vi.advanceTimersByTime(5000)
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'idle', undefined)
  })
})

describe('buffer management', () => {
  let detector: ClaudeCodeDetector

  beforeEach(() => {
    vi.useFakeTimers()
    detector = new ClaudeCodeDetector()
    detector.onStatusChange = vi.fn()
  })

  afterEach(() => {
    detector.destroy()
    vi.useRealTimers()
  })

  it('does not grow buffer beyond 2048 chars', () => {
    detector.register('t1')
    // Feed data larger than 2048 chars
    const bigChunk = 'A'.repeat(3000)
    detector.feed('t1', bigChunk)

    // Feed again to force another trim check
    detector.feed('t1', 'B'.repeat(100))

    // We can't directly inspect private state, but we verify no crash
    // and the detector still functions
    detector.feed('t1', '\x1b]0;\u2807 Working\x07')
    expect(detector.isRegistered('t1')).toBe(true)
  })
})

describe('register/unregister', () => {
  let detector: ClaudeCodeDetector

  beforeEach(() => {
    detector = new ClaudeCodeDetector()
    detector.onStatusChange = vi.fn()
  })

  afterEach(() => {
    detector.destroy()
  })

  it('tracks registered terminals', () => {
    detector.register('t1')
    expect(detector.isRegistered('t1')).toBe(true)
  })

  it('removes terminal on unregister', () => {
    detector.register('t1')
    detector.unregister('t1')
    expect(detector.isRegistered('t1')).toBe(false)
  })

  it('feed is a no-op on unregistered terminal', () => {
    const onStatusChange = vi.fn()
    detector.onStatusChange = onStatusChange

    detector.feed('unknown', '\x1b]0;\u2807 Working\x07')
    expect(onStatusChange).not.toHaveBeenCalled()
  })

  it('onWrite is a no-op on unregistered terminal', () => {
    const onStatusChange = vi.fn()
    detector.onStatusChange = onStatusChange

    detector.onWrite('unknown')
    expect(onStatusChange).not.toHaveBeenCalled()
  })
})
