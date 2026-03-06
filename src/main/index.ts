import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty-manager'
import { registerIpcHandlers } from './ipc-handlers'

const ptyManager = new PtyManager()
const isDev = !!process.env.ELECTRON_RENDERER_URL

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
