import { app, BrowserWindow, dialog, ipcMain, Menu, session } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty-manager'
import { ClaudeCodeDetector } from './claude-detector'
import { NotificationManager } from './notification-manager'
import { registerIpcHandlers } from './ipc-handlers'
import { IPC_CHANNELS, SHORTCUT_NAMES } from '../shared/ipc-types'

const SHORTCUT_ACCELERATORS: Record<string, string> = {
  'new-terminal': 'CmdOrCtrl+Shift+T',
  'close-terminal': 'CmdOrCtrl+Shift+W',
  'split-right': 'CmdOrCtrl+Shift+D',
  'split-down': 'CmdOrCtrl+Shift+E',
  'cycle-group-forward': 'Ctrl+Tab',
  'cycle-group-backward': 'Ctrl+Shift+Tab',
  'navigate-left': 'Alt+Left',
  'navigate-right': 'Alt+Right',
  'navigate-up': 'Alt+Up',
  'navigate-down': 'Alt+Down',
  'toggle-sidebar': 'CmdOrCtrl+B',
}

app.setAppUserModelId('com.terminal-manager.app')

const ptyManager = new PtyManager()
const detector = new ClaudeCodeDetector()
let notificationManager: NotificationManager
const isDev = !!process.env.ELECTRON_RENDERER_URL

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // Required: preload bundle uses require() for electron modules
    }
  })

  // C1: Content Security Policy — relaxed in dev for Vite HMR
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:;"
          ]
        }
      })
    })
  }

  // C3: Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  // M17: Deny all permission requests
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  ptyManager.setWindow(mainWindow)
  ptyManager.setDetector(detector)

  notificationManager = new NotificationManager(() => mainWindow)

  detector.onStatusChange = (id, status, contextTitle) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.CLAUDE_STATUS, id, status, contextTitle)
    }
    notificationManager.notify(id, status, contextTitle)
  }

  ipcMain.on(IPC_CHANNELS.NOTIFICATION_ACTIVE_TERMINAL, (_, id: string | null) => {
    notificationManager.setActiveTerminal(id)
  })

  const shortcutItems: Electron.MenuItemConstructorOptions[] = SHORTCUT_NAMES.map((name) => ({
    label: name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    accelerator: SHORTCUT_ACCELERATORS[name],
    click: (): void => {
      mainWindow.webContents.send(`shortcut:${name}`)
    }
  }))

  const sendShortcut = (name: string): void => {
    mainWindow.webContents.send(`shortcut:${name}`)
  }

  const viewSubmenu: Electron.MenuItemConstructorOptions[] = [
    { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: (): void => sendShortcut('toggle-sidebar') },
    { type: 'separator' },
    { label: 'Split Right', click: (): void => sendShortcut('split-right') },
    { label: 'Split Down', click: (): void => sendShortcut('split-down') },
    { type: 'separator' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { role: 'resetZoom' },
  ]
  if (isDev) {
    viewSubmenu.push({ type: 'separator' }, { role: 'toggleDevTools' })
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Shortcuts', submenu: shortcutItems },
    {
      label: 'File',
      submenu: [
        { label: 'New Terminal', click: (): void => sendShortcut('new-terminal') },
        { label: 'Close Terminal', click: (): void => sendShortcut('close-terminal') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy', accelerator: 'CmdOrCtrl+Shift+C' },
        { role: 'paste', accelerator: 'CmdOrCtrl+Shift+V' },
      ],
    },
    { label: 'View', submenu: viewSubmenu },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Terminal Manager',
          click: (): void => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Terminal Manager',
              message: 'Terminal Manager',
              detail: 'A VS Code-style integrated terminal manager.\nBuilt with Electron + React + xterm.js',
            })
          },
        },
      ],
    },
  ]))

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers(ptyManager, detector)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// M11: Clean up PTYs on quit (handles force-quit, crash)
app.on('before-quit', () => {
  ptyManager.destroyAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
