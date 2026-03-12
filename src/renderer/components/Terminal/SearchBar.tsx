import { useEffect, useRef, useState } from 'react'
import { searchAddonRegistry } from '../../lib/search-registry'
import '../../assets/styles/search-bar.css'

interface SearchBarProps {
  terminalId: string
  onClose: () => void
}

export default function SearchBar({ terminalId, onClose }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [resultIndex, setResultIndex] = useState(-1)
  const [resultCount, setResultCount] = useState(0)

  const addon = searchAddonRegistry.get(terminalId)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Subscribe to match count updates
  useEffect(() => {
    if (!addon) return
    const disposable = addon.onDidChangeResults?.((e) => {
      setResultIndex(e.resultIndex)
      setResultCount(e.resultCount)
    })
    return () => disposable?.dispose()
  }, [addon])

  // Search as you type
  useEffect(() => {
    if (!addon) return
    if (query) {
      addon.findNext(query, { decorations: { activeMatchColorOverviewRuler: '#f0a020', matchOverviewRuler: '#888888' } })
    } else {
      addon.clearDecorations()
      setResultIndex(-1)
      setResultCount(0)
    }
  }, [query, addon])

  // Clear decorations on unmount
  useEffect(() => {
    return () => { addon?.clearDecorations() }
  }, [addon])

  const findNext = () => { if (addon && query) addon.findNext(query) }
  const findPrev = () => { if (addon && query) addon.findPrevious(query) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) findPrev()
      else findNext()
    }
  }

  const countLabel = query
    ? resultCount > 0
      ? `${resultIndex + 1} of ${resultCount}`
      : 'No results'
    : ''

  return (
    <div className="terminal-search-bar">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
        spellCheck={false}
      />
      <span className="search-count">{countLabel}</span>
      <button onClick={findPrev} title="Previous (Shift+Enter)" aria-label="Previous match">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 7l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <button onClick={findNext} title="Next (Enter)" aria-label="Next match">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <button onClick={onClose} title="Close (Escape)" aria-label="Close search">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
