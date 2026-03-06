import { BrowserWindow, Notification } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-types'

type NotifiableStatus = 'needs-input' | 'completed'

const NOTIFIABLE_STATUSES = new Set<string>(['needs-input', 'completed'])
const DEBOUNCE_MS = 3000

export class NotificationManager {
  private activeNotifications = new Map<string, Notification>()
  private lastNotifyTime = new Map<string, number>()
  private activeTerminalId: string | null = null

  constructor(private getWindow: () => BrowserWindow | null) {}

  notify(terminalId: string, status: string, contextTitle?: string): void {
    if (!NOTIFIABLE_STATUSES.has(status)) return
    if (!Notification.isSupported()) return

    // Debounce: skip if notified too recently for this terminal
    const now = Date.now()
    const lastTime = this.lastNotifyTime.get(terminalId)
    if (lastTime !== undefined && now - lastTime < DEBOUNCE_MS) return

    // Suppress if window is focused and this terminal is already active
    const win = this.getWindow()
    if (win && win.isFocused() && !win.isMinimized() && this.activeTerminalId === terminalId) {
      return
    }

    // Close existing notification for this terminal to prevent stacking
    const existing = this.activeNotifications.get(terminalId)
    if (existing) {
      existing.close()
    }

    const body = this.buildBody(status as NotifiableStatus, contextTitle)

    const notification = new Notification({
      title: 'Terminal Manager',
      body,
    })

    notification.on('click', () => {
      const w = this.getWindow()
      if (w) {
        w.restore()
        w.show()
        w.focus()
        w.webContents.send(IPC_CHANNELS.NOTIFICATION_FOCUS_TERMINAL, terminalId)
      }
    })

    notification.on('close', () => {
      // Only remove if this is still the current notification for this terminal
      if (this.activeNotifications.get(terminalId) === notification) {
        this.activeNotifications.delete(terminalId)
      }
    })

    notification.show()
    this.activeNotifications.set(terminalId, notification)
    this.lastNotifyTime.set(terminalId, now)
  }

  setActiveTerminal(id: string | null): void {
    this.activeTerminalId = id
  }

  destroy(): void {
    const notifications = Array.from(this.activeNotifications.values())
    for (let i = 0; i < notifications.length; i++) {
      notifications[i].close()
    }
    this.activeNotifications.clear()
    this.lastNotifyTime.clear()
    this.activeTerminalId = null
  }

  private buildBody(status: NotifiableStatus, contextTitle?: string): string {
    const message =
      status === 'needs-input' ? 'Claude needs your input' : 'Claude has finished'

    return contextTitle ? `${message} - ${contextTitle}` : message
  }
}
