import { useEffect } from 'react'
import { useTerminalStore } from '../store/terminal-store'
import { onShortcutSafe, setWindowTitleSafe } from '../lib/ipc-api'
import type { NavigationDirection } from '../store/types'

export function useShortcuts(): void {
  useEffect(() => {
    const getState = useTerminalStore.getState

    const unsubscribers = [
      onShortcutSafe('new-terminal', () => getState().addTerminal()),
      onShortcutSafe('close-terminal', () => {
        const s = getState()
        const group = s.groups.find((g) => g.id === s.activeGroupId)
        if (group) s.removeTerminal(group.activeTerminalId)
      }),
      onShortcutSafe('split-right', () => {
        const s = getState()
        const group = s.groups.find((g) => g.id === s.activeGroupId)
        if (group) s.splitTerminal(group.activeTerminalId, 'horizontal')
      }),
      onShortcutSafe('split-down', () => {
        const s = getState()
        const group = s.groups.find((g) => g.id === s.activeGroupId)
        if (group) s.splitTerminal(group.activeTerminalId, 'vertical')
      }),
      onShortcutSafe('cycle-group-forward', () => getState().cycleGroup(1)),
      onShortcutSafe('cycle-group-backward', () => getState().cycleGroup(-1)),
      ...(['left', 'right', 'up', 'down'] as NavigationDirection[]).map((dir) =>
        onShortcutSafe(`navigate-${dir}`, () => getState().navigatePane(dir))
      ),
    ]

    return () => unsubscribers.forEach((fn) => fn())
  }, [])

  // Window title tracking
  useEffect(() => {
    const updateTitle = (): void => {
      const s = useTerminalStore.getState()
      const group = s.groups.find((g) => g.id === s.activeGroupId)
      if (group) {
        const terminal = s.terminals[group.activeTerminalId]
        const name = terminal?.title ?? 'Terminal'
        setWindowTitleSafe(`${name} - Terminal Manager`)
      } else {
        setWindowTitleSafe('Terminal Manager')
      }
    }

    updateTitle()
    const unsub = useTerminalStore.subscribe(updateTitle)
    return unsub
  }, [])
}
