import { ipcMain, BrowserWindow } from 'electron'
import type { AppSettings, DockPosition } from '../../src/types'
import { SessionManager } from '../services/sessionManager'

// 默认设置
const defaultSettings: AppSettings = {
  autoStart: false,
  edgeDock: true,
  theme: 'dark',
  shortcut: 'Ctrl+Shift+V',
  opacity: 0.95,
  soundEnabled: true
}

let currentSettings: AppSettings = { ...defaultSettings }
let sessionManager: SessionManager | null = null

/**
 * 绑定会话管理器（由 main.ts 调用）
 */
export function setSessionManager(manager: SessionManager): void {
  sessionManager = manager
}

/**
 * 注册 IPC 处理器
 */
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // 窗口控制
  ipcMain.on('window:toggle-expand', () => {
    const notchWindow = BrowserWindow.fromId(mainWindow.id)
    if (notchWindow) {
      notchWindow.webContents.send('window:toggle-expand')
    }
  })

  ipcMain.on('window:set-expanded', (_event, expanded: boolean) => {
    const notchWindow = BrowserWindow.fromId(mainWindow.id)
    if (notchWindow) {
      notchWindow.webContents.send('window:expand-changed', expanded)
    }
  })

  ipcMain.on('window:dock', (_event, position: DockPosition) => {
    const notchWindow = BrowserWindow.fromId(mainWindow.id)
    if (notchWindow) {
      notchWindow.webContents.send('window:dock', position)
    }
  })

  ipcMain.on('window:show', () => {
    const notchWindow = BrowserWindow.fromId(mainWindow.id)
    if (notchWindow) {
      notchWindow.show()
      notchWindow.setSkipTaskbar(true)
    }
  })

  ipcMain.on('window:hide', () => {
    const notchWindow = BrowserWindow.fromId(mainWindow.id)
    if (notchWindow) {
      notchWindow.hide()
    }
  })

  // 设置管理
  ipcMain.handle('settings:get', () => {
    return currentSettings
  })

  ipcMain.on('settings:set', (_event, settings: AppSettings) => {
    currentSettings = { ...settings }
    // 广播设置变更
    const notchWindow = BrowserWindow.fromId(mainWindow.id)
    if (notchWindow) {
      notchWindow.webContents.send('settings:changed', currentSettings)
    }
  })

  // 退出应用
  ipcMain.on('app:quit', () => {
    const notchWindow = BrowserWindow.fromId(mainWindow.id)
    if (notchWindow) {
      notchWindow.close()
    }
  })

  // 鼠标穿透控制（透明区域穿透到下方窗口）
  ipcMain.on('window:set-mouse-ignore', (_event, ignore: boolean) => {
    const notchWindow = BrowserWindow.fromId(mainWindow.id)
    if (notchWindow && process.platform === 'win32') {
      notchWindow.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })

  // 会话管理（自动发现模式，不再手动创建/销毁）
  ipcMain.handle('session:create', () => {
    throw new Error('Manual session creation is disabled. Sessions are auto-discovered from Claude Code logs.')
  })

  ipcMain.on('session:kill', () => {
    // 自动发现模式下不支持手动 kill
  })
}

/**
 * 更新会话数据并发送到渲染进程
 */
export function updateSessions(mainWindow: BrowserWindow, sessions: unknown): void {
  mainWindow.webContents.send('sessions:update', sessions)
}

/**
 * 获取当前设置
 */
export function getSettings(): AppSettings {
  return { ...currentSettings }
}
