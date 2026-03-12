import { useCallback, useRef } from 'react'
import '../../assets/styles/compose-bar.css'

interface ComposeBarProps {
  onSubmit: (text: string) => void
  onEscape?: () => void
}

export default function ComposeBar({ onSubmit, onEscape }: ComposeBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const maxHeightRef = useRef<number>(0)

  // Auto-resize textarea to content (up to ~5 lines).
  // Once content exceeds max-height the textarea is scrollable and height
  // stays pinned — skip the expensive height:0→scrollHeight reflow.
  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return

    // Cache computed max-height (only read once)
    if (!maxHeightRef.current) {
      maxHeightRef.current = parseFloat(getComputedStyle(ta).maxHeight) || 0
    }

    const maxH = maxHeightRef.current
    if (maxH) {
      // Cheap check: if the inline height is already at max and the content
      // still overflows, a reflow won't change anything — bail out.
      const currentH = parseFloat(ta.style.height)
      if (currentH >= maxH && ta.scrollHeight >= maxH) return
    }

    ta.style.height = '0'
    const scrollH = ta.scrollHeight
    ta.style.height = (maxH ? Math.min(scrollH, maxH) : scrollH) + 'px'
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const text = ta.value.trim()
      if (!text) return
      onSubmit(text)
      ta.value = ''
      ta.style.height = ''
    } else if (e.key === 'Escape') {
      e.preventDefault()
      textareaRef.current?.blur()
      onEscape?.()
    }
  }

  // Stop mousedown from bubbling to the terminal pane's handleMouseDown,
  // which triggers setActiveTerminal → xterm.focus() and steals focus.
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div className="compose-bar" onMouseDown={stopPropagation}>
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder="Type your response..."
        onKeyDown={handleKeyDown}
        onInput={autoResize}
        spellCheck={false}
      />
      <span className="compose-bar-hint">Enter to send · Esc to focus terminal</span>
    </div>
  )
}
