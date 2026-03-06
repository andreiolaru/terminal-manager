---
description: Activate shell/terminal expertise for PTY behavior, escape sequences, and shell integration
---

You are now operating with shell and terminal emulation expertise, relevant to this terminal-manager project's PTY and shell handling.

## How This Project Uses Shells

- **node-pty** spawns real OS pseudo-terminal processes
- Default shell: `powershell.exe` (configured in `src/renderer/lib/constants.ts`)
- Shell allowlist in `src/main/ipc-handlers.ts`: powershell.exe, pwsh.exe, cmd.exe, bash.exe, wsl.exe, git-bash.exe
- Case-insensitive matching (e.g., `PowerShell.EXE` is accepted)
- Terminal type: `xterm-256color`

## PTY Lifecycle

1. Renderer calls `ipcApi.createPty({ id, cols, rows })`
2. Main process: `pty.spawn(shell, [], { name: 'xterm-256color', cols, rows, cwd, env })`
3. PTY data flows: `ptyProcess.onData` → `webContents.send('pty:data')` → xterm.write
4. User input flows: `terminal.onData` → `ipcApi.writePty` → `ptyProcess.write`
5. Resize: `fitAddon.fit()` → `ipcApi.resizePty` → `ptyProcess.resize`
6. Destroy: `ptyManager.destroy(id)` — removes from map, then kills

## Terminal Emulation (xterm.js)

- xterm.js handles VT100/VT220/xterm escape sequence parsing
- WebGL renderer preferred, canvas fallback on failure
- Scrollback: 5000 lines (configurable in constants)
- Font: Cascadia Code → Consolas → monospace

## Shell-Specific Considerations

### PowerShell
- Writes ANSI escape sequences for colors and prompts
- PSReadLine handles line editing within the PTY
- `$env:TERM` set to `xterm-256color` via pty spawn options
- Exit code available via `ptyProcess.onExit`

### cmd.exe
- Limited ANSI support on older Windows — xterm.js handles rendering
- Prompt is simple `C:\path>`

### WSL / bash
- Full ANSI/xterm compatibility
- May output different line endings

## Common Issues

- **0×0 resize kills PTY**: Never call `fitAddon.fit()` when terminal is `display:none` — guard with visibility check
- **Shell not found**: If shell exe isn't on PATH, pty.spawn throws — caught and shown in terminal
- **Orphan processes**: PTY processes outlive the app if not killed — `destroyAll()` on `before-quit`
- **Environment variables**: `undefined` values filtered out before passing to pty.spawn

When working with shell integration, PTY behavior, or escape sequence issues, apply this context.
