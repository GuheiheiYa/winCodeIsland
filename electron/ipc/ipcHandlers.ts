import { ipcMain, BrowserWindow } from 'electron'
import type { AppSettings, DockPosition } from '../../src/types'

// 默认设置
const defaultSettings: AppSettings = {
  autoStart: false,
  edgeDock: true,
  theme: 'dark',
  shortcut: 'Ctrl+Shift+V',
  opacity: 0.95
}

let currentSettings: AppSettings = { ...defaultSettings }

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
