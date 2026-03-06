import { app, BrowserWindow, Menu, session } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty-manager'
import { registerIpcHandlers } from './ipc-handlers'
import { SHORTCUT_NAMES } from '../shared/ipc-types'

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
}

const ptyManager = new PtyManager()
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

  const menuItems: Electron.MenuItemConstructorOptions[] = SHORTCUT_NAMES.map((name) => ({
    label: name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    accelerator: SHORTCUT_ACCELERATORS[name],
    click: (): void => {
      mainWindow.webContents.send(`shortcut:${name}`)
    }
  }))
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Shortcuts', submenu: menuItems }]))

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers(ptyManager)
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
