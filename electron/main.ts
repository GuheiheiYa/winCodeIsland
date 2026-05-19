import { app } from 'electron'
import { NotchWindowManager } from './windows/notchWindow'
import { TrayManager } from './tray/trayManager'
import { registerIpcHandlers, updateSessions } from './ipc/ipcHandlers'

/**
 * Electron 主进程入口
 */

// 保持窗口对象的全局引用，防止被垃圾回收
let notchWindowManager: NotchWindowManager | null = null
let trayManager: TrayManager | null = null

// 模拟会话数据定时器
let mockDataInterval: NodeJS.Timeout | null = null

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

  // 启动模拟数据服务（开发模式）
  if (!app.isPackaged) {
    startMockDataService(mainWindow)
  }
}

/**
 * 启动模拟数据服务
 * 定时发送模拟会话数据到渲染进程
 */
function startMockDataService(mainWindow: Electron.BrowserWindow): void {
  // 初始数据
  const mockSessions = [
    {
      id: 'session-1',
      projectName: 'vibe-notch',
      sessionNumber: '#8387',
      agentType: 'claude' as const,
      terminalType: 'ghostty' as const,
      status: 'sleeping' as const,
      lastOutput: [
        { type: 'prompt' as const, content: '$ 搞定。两个 README 都加了图...' },
        { type: 'output' as const, content: '> 有没有专业的截图工具啊' },
        { type: 'prompt' as const, content: '$ 没装专业截图工具。推荐你装一个 ' },
        { type: 'link' as const, content: 'Shottr', linkUrl: 'https://shottr.cc' },
        { type: 'prompt' as const, content: '（免费、轻量），可以：' }
      ],
      timestamp: Date.now() - 3600000,
      relativeTime: '1h'
    },
    {
      id: 'session-2',
      projectName: 'wxt',
      sessionNumber: undefined,
      agentType: 'claude' as const,
      terminalType: 'iterm2' as const,
      status: 'sleeping' as const,
      lastOutput: [
        { type: 'output' as const, content: '> 哦' },
        { type: 'prompt' as const, content: '$ Bro，有事随时说，我在这儿呢。' }
      ],
      timestamp: Date.now() - 30000,
      relativeTime: '<1m'
    },
    {
      id: 'session-3',
      projectName: 'vibe-notch',
      sessionNumber: '#demo',
      agentType: 'claude' as const,
      terminalType: 'ghostty' as const,
      status: 'thinking' as const,
      lastOutput: [
        { type: 'thinking' as const, content: 'thinking_' }
      ],
      timestamp: Date.now() - 60000,
      relativeTime: '1m'
    },
    {
      id: 'session-4',
      projectName: 'api-server',
      sessionNumber: undefined,
      agentType: 'claude' as const,
      terminalType: 'ghostty' as const,
      status: 'thinking' as const,
      lastOutput: [
        { type: 'output' as const, content: '> Fix the login bug' },
        { type: 'thinking' as const, content: 'thinking_' }
      ],
      timestamp: Date.now() - 60000,
      relativeTime: '1m'
    },
    {
      id: 'session-5',
      projectName: 'web-dashboard',
      sessionNumber: undefined,
      agentType: 'claude' as const,
      terminalType: 'iterm2' as const,
      status: 'sleeping' as const,
      lastOutput: [],
      timestamp: Date.now() - 60000,
      relativeTime: '1m'
    },
    // working 状态
    {
      id: 'session-6',
      projectName: 'notch-builder',
      sessionNumber: undefined,
      agentType: 'claude' as const,
      terminalType: 'iterm2' as const,
      status: 'working' as const,
      lastOutput: [
        { type: 'output' as const, content: '> 构建中...' },
        { type: 'prompt' as const, content: '$ npm run build' },
        { type: 'output' as const, content: '> Build success in 2.3s' }
      ],
      timestamp: Date.now() - 120000,
      relativeTime: '2m'
    },
    // sleeping 状态
    {
      id: 'session-7',
      projectName: 'dashboard',
      sessionNumber: undefined,
      agentType: 'claude' as const,
      terminalType: 'ghostty' as const,
      status: 'sleeping' as const,
      lastOutput: [
        { type: 'prompt' as const, content: '$ done. ready for next task' }
      ],
      timestamp: Date.now() - 300000,
      relativeTime: '5m'
    },
    // thinking 状态
    {
      id: 'session-8',
      projectName: 'docs-site',
      sessionNumber: undefined,
      agentType: 'claude' as const,
      terminalType: 'iterm2' as const,
      status: 'thinking' as const,
      lastOutput: [
        { type: 'output' as const, content: '> Write the API documentation' },
        { type: 'thinking' as const, content: 'thinking_' }
      ],
      timestamp: Date.now() - 30000,
      relativeTime: '30s'
    }
  ]

  // 立即发送一次数据
  updateSessions(mainWindow, mockSessions)

  // 定时更新模拟数据
  let toggle = true
  mockDataInterval = setInterval(() => {
    toggle = !toggle
    // 随机更新 thinking 光标
    const updated = mockSessions.map((s, i) => {
      if (s.status === 'thinking') {
        return {
          ...s,
          lastOutput: s.lastOutput.map((line: { type: string; content?: string }) =>
            line.type === 'thinking'
              ? { ...line, content: toggle ? 'thinking_' : 'thinking' }
              : line
          )
        }
      }
      // 随机切换某个会话状态
      if (Math.random() > 0.95 && i === 0) {
        return {
          ...s,
          status: s.status === 'working' ? 'sleeping' : 'working' as const
        }
      }
      return s
    })

    updateSessions(mainWindow, updated)
  }, 500)
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
  if (mockDataInterval) {
    clearInterval(mockDataInterval)
  }
  trayManager?.destroy()
  notchWindowManager?.destroy()
})
