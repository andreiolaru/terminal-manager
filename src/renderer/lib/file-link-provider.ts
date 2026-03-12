import type { Terminal, ILinkProvider, ILink } from '@xterm/xterm'

// Matches file paths with common extensions, optionally followed by :line or :line:col
// Captures: relative (src/foo.ts), explicit relative (./foo.ts), Windows absolute (C:\foo.ts), Unix absolute (/foo.ts)
const FILE_EXTENSIONS = 'ts|tsx|js|jsx|mjs|cjs|json|css|scss|html|md|mdx|py|go|rs|rb|java|kt|c|cpp|h|hpp|cs|swift|vue|svelte|yml|yaml|toml|sh|bash|ps1|env|txt|cfg|conf|xml|sql|graphql|prisma|proto|dockerfile|makefile'
const FILE_PATH_RE = new RegExp(
  `(?:^|[\\s"'\`({,])` +                         // boundary
  `(` +
    `(?:[A-Za-z]:\\\\|/)?` +                      // optional drive letter or root slash
    `(?:[\\w.@-]+[/\\\\])*` +                     // directory segments
    `[\\w.@-]+\\.(?:${FILE_EXTENSIONS})` +        // filename.ext
  `)` +
  `(?::(\\d+)(?::(\\d+))?)?` +                    // optional :line:col
  `(?=[\\s"'\`)},:;]|$)`,                         // boundary
  'gi'
)

export function createFileLinkProvider(getCwd: () => string): ILinkProvider {
  return {
    provideLinks(lineNumber: number, callback: (links: ILink[] | undefined) => void): void {
      // We need access to the terminal buffer to get line text
      // The terminal is not passed to provideLinks, so we use a trick:
      // store a reference when registering
      const links = (this as ProviderWithTerminal)._links(lineNumber)
      callback(links.length > 0 ? links : undefined)
    }
  }
}

interface ProviderWithTerminal extends ILinkProvider {
  _links(lineNumber: number): ILink[]
}

export function registerFileLinkProvider(terminal: Terminal, getCwd: () => string): void {
  const provider: ProviderWithTerminal = {
    provideLinks(lineNumber: number, callback: (links: ILink[] | undefined) => void): void {
      const links = this._links(lineNumber)
      callback(links.length > 0 ? links : undefined)
    },

    _links(lineNumber: number): ILink[] {
      const buffer = terminal.buffer.active
      const line = buffer.getLine(lineNumber - 1) // buffer is 0-indexed, lineNumber is 1-indexed
      if (!line) return []

      let text = ''
      for (let i = 0; i < terminal.cols; i++) {
        const cell = line.getCell(i)
        text += cell ? (cell.getChars() || ' ') : ' '
      }

      const links: ILink[] = []
      FILE_PATH_RE.lastIndex = 0

      let match: RegExpExecArray | null
      while ((match = FILE_PATH_RE.exec(text)) !== null) {
        const filePath = match[1]
        const lineNum = match[2]
        const colNum = match[3]

        // Full matched text including :line:col
        let fullMatch = filePath
        if (lineNum) fullMatch += `:${lineNum}`
        if (colNum) fullMatch += `:${colNum}`

        // Find the start position of the file path in the line
        const startIdx = match.index + (match[0].length - fullMatch.length)

        links.push({
          range: {
            start: { x: startIdx + 1, y: lineNumber }, // x is 1-indexed
            end: { x: startIdx + fullMatch.length + 1, y: lineNumber }
          },
          text: fullMatch,
          activate: () => {
            const cwd = getCwd()
            window.electronAPI.openInEditor(fullMatch, cwd)
          }
        })
      }

      return links
    }
  }

  terminal.registerLinkProvider(provider)
}
