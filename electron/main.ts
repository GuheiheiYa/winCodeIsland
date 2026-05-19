import { app } from 'electron'
import { NotchWindowManager } from './windows/notchWindow'
import { TrayManager } from './tray/trayManager'
import { registerIpcHandlers, setSessionManager } from './ipc/ipcHandlers'
import { SessionManager } from './services/sessionManager'

/**
 * Electron 主进程入口
 */

// 保持窗口对象的全局引用，防止被垃圾回收
let notchWindowManager: NotchWindowManager | null = null
let trayManager: TrayManager | null = null
let sessionManager: SessionManager | null = null

/**
 * 创建应用窗口和托盘
 */
async function createApp(): Promise<void> {
  // 创建灵动岛窗口
  notchWindowManager = new NotchWindowManager()
  const mainWindow = notchWindowManager.create()

  // 加载渲染进程页面
  if (!app.isPackaged) {
    // 开发模式
    await mainWindow.loadURL('http://localhost:5173')
    // 开发工具
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 生产模式
    await mainWindow.loadFile('out/renderer/index.html')
  }

  // 注册 IPC 处理器
  registerIpcHandlers(mainWindow)

  // 创建系统托盘
  trayManager = new TrayManager()
  trayManager.create(mainWindow)

  // 初始化会话管理器（通过 Claude Code 日志自动发现会话）
  sessionManager = new SessionManager()
  sessionManager.attach(mainWindow)
  setSessionManager(sessionManager)
  sessionManager.start()
}

/**
 * 应用生命周期
 */

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
  createApp()

  app.on('activate', () => {
    // macOS 上点击 dock 图标时重新创建窗口
    if (notchWindowManager === null) {
      createApp()
    }
  })
})

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出前清理
app.on('before-quit', () => {
  sessionManager?.stop()
  trayManager?.destroy()
  notchWindowManager?.destroy()
})
