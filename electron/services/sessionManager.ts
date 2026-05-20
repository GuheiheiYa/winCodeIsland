import { BrowserWindow } from 'electron'
import { ClaudeLogMonitor } from './claudeLogMonitor'
import { primeTerminalFocusCache, updateSessions } from '../ipc/ipcHandlers'

/**
 * Claude 会话管理器
 * 通过监控 Claude Code 本地日志文件获取会话状态，定时推送到渲染进程
 */
export class SessionManager {
  private monitor: ClaudeLogMonitor
  private mainWindow: BrowserWindow | null = null
  private pushTimer: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  constructor() {
    this.monitor = new ClaudeLogMonitor()
  }

  /**
   * 绑定主窗口
   */
  attach(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 启动会话监控
   */
  start(): void {
    if (this.isRunning) return
    this.isRunning = true

    // 立即推送一次
    this.pushSessions()

    // 每 1.5 秒扫描一次日志
    this.pushTimer = setInterval(() => {
      this.pushSessions()
    }, 1500)
  }

  /**
   * 停止监控
   */
  stop(): void {
    this.isRunning = false
    if (this.pushTimer) {
      clearInterval(this.pushTimer)
      this.pushTimer = null
    }
  }

  /**
   * 获取当前所有会话
   */
  getAllSessions() {
    return this.monitor.scanSessions()
  }

  /**
   * 推送会话数据到渲染进程
   */
  private pushSessions(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    const sessions = this.getAllSessions()
    primeTerminalFocusCache(sessions)
    updateSessions(this.mainWindow, sessions)
  }
}
