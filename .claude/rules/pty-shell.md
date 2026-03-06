---
paths:
  - "src/main/pty-manager.ts"
  - "src/main/ipc-handlers.ts"
---

# PTY & Shell Rules

## Shell Configuration

- node-pty spawns real OS pseudo-terminal processes
- Default shell: `powershell.exe` (configured in `src/renderer/lib/constants.ts`)
- Shell allowlist: powershell.exe, pwsh.exe, cmd.exe, bash.exe, wsl.exe, git-bash.exe
- Case-insensitive matching (e.g., `PowerShell.EXE` is accepted)
- Terminal type: `xterm-256color`

## PTY Lifecycle

1. Renderer calls `ipcApi.createPty({ id, cols, rows })`
2. Main process: `pty.spawn(shell, [], { name: 'xterm-256color', cols, rows, cwd, env })`
3. PTY data: `ptyProcess.onData` > `webContents.send('pty:data')` > xterm.write
4. User input: `terminal.onData` > `ipcApi.writePty` > `ptyProcess.write`
5. Resize: `fitAddon.fit()` > `ipcApi.resizePty` > `ptyProcess.resize`
6. Destroy: `ptyManager.destroy(id)` — removes from map, then kills

## Input Validation

- Cols/rows: `Number.isFinite(x) && x > 0 ? Math.floor(x) : default`
- Shell name: checked against allowlist (case-insensitive)
- CWD: validated with `existsSync`
- Environment: `undefined` values filtered out before passing to pty.spawn

## Common Issues

- **0x0 resize kills PTY**: Never call `fitAddon.fit()` when terminal is `display:none`
- **Shell not found**: If shell exe isn't on PATH, pty.spawn throws — caught and shown in terminal
- **Orphan processes**: PTY processes outlive the app if not killed — `destroyAll()` on `before-quit`
