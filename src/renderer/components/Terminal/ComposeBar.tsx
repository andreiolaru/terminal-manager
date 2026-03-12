import { useCallback, useRef } from 'react'
import '../../assets/styles/compose-bar.css'

interface ComposeBarProps {
  onSubmit: (text: string) => void
  onEscape?: () => void
}

export default function ComposeBar({ onSubmit, onEscape }: ComposeBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to content (up to ~5 lines)
  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = '0'
    ta.style.height = ta.scrollHeight + 'px'
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

  return (
    <div className="compose-bar">
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
