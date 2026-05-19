import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

/**
 * 灵动岛窗口管理器
 * 负责创建和管理无边框置顶窗口，处理贴边吸附逻辑
 */
export class NotchWindowManager {
  private window: BrowserWindow | null = null
  private isExpanded = false
  private dockPosition: 'top' | 'bottom' | 'left' | 'right' | 'none' = 'none'
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 }
  private isDragging = false
  private snapThreshold = 40 // 贴边吸附阈值（像素）

  // 收起状态尺寸
  private readonly collapsedWidth = 300
  private readonly collapsedHeight = 36

  // 展开状态尺寸
  private readonly expandedWidth = 560
  private readonly expandedMaxHeightRatio = 0.8 // 最大占屏幕高度的 80%
  private readonly expandedFixedHeight = 370 // 展开面板固定高度（内容可滚动）

  create(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    this.window = new BrowserWindow({
      width: this.collapsedWidth,
      height: this.collapsedHeight,
      x: Math.round((screenWidth - this.collapsedWidth) / 2),
      y: 0, // 紧贴屏幕顶部
      frame: false,
      alwaysOnTop: true,
      visibleOnAllWorkspaces: true,
      skipTaskbar: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      },
      // Windows 特定设置
      ...(process.platform === 'win32' ? {
        type: 'toolbar' as const
      } : {})
    })

    // 设置窗口层级（Windows 置顶）
    this.window.setAlwaysOnTop(true, 'screen-saver')

    // 默认穿透透明区域（Windows），由渲染进程动态控制内容区域是否接收事件
    if (process.platform === 'win32') {
      this.window.setIgnoreMouseEvents(true, { forward: true })
    }

    // 监听窗口移动（拖拽结束检测贴边）
    this.setupDragListeners()

    // 监听 IPC 事件
    this.setupIpcListeners()

    return this.window
  }

  /**
   * 设置拖拽监听器
   */
  private setupDragListeners(): void {
    if (!this.window) return

    // 监听来自渲染进程的拖拽事件
    this.window.webContents.on('ipc-message', (_event, channel, ...args) => {
      if (channel === 'drag-start') {
        this.isDragging = true
        const [mouseX, mouseY] = args as number[]
        const pos = this.window!.getPosition()
        this.dragOffset = { x: mouseX - pos[0], y: mouseY - pos[1] }
      } else if (channel === 'drag-move') {
        if (!this.isDragging) return
        const [mouseX, mouseY] = args as number[]
        this.window!.setPosition(
          Math.round(mouseX - this.dragOffset.x),
          Math.round(mouseY - this.dragOffset.y)
        )
      } else if (channel === 'drag-end') {
        this.isDragging = false
        this.checkEdgeSnap()
      }
    })
  }

  /**
   * 设置 IPC 监听器
   */
  private setupIpcListeners(): void {
    if (!this.window) return

    const wc = this.window.webContents

    wc.on('ipc-message', (_event, channel, ...args) => {
      switch (channel) {
        case 'window:toggle-expand':
          this.toggleExpand()
          break
        case 'window:set-expanded':
          this.setExpanded(args[0] as boolean)
          break
        case 'window:dock':
          this.dockToEdge(args[0] as 'top' | 'bottom' | 'left' | 'right' | 'none')
          break
      }
    })
  }

  /**
   * 切换展开/收起状态
   */
  toggleExpand(): void {
    this.setExpanded(!this.isExpanded)
  }


  /**
   * 设置展开状态
   */
  setExpanded(expanded: boolean): void {
    if (!this.window || this.isExpanded === expanded) return

    this.isExpanded = expanded
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    const currentPos = this.window.getPosition()
    const maxHeight = Math.round(screenHeight * this.expandedMaxHeightRatio)

    if (expanded) {
      // 展开 - 固定高度，内容在面板内部滚动
      const newWidth = this.expandedWidth
      const newHeight = Math.min(this.expandedFixedHeight, maxHeight)
      const newX = Math.round(Math.min(
        Math.max(currentPos[0] + this.collapsedWidth / 2 - newWidth / 2, 0),
        screenWidth - newWidth
      ))
      const newY = 0 // 紧贴屏幕顶部

      this.window.setBounds({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      })
    } else {
      // 收起 - 变为 pill 形状
      const newWidth = this.collapsedWidth
      const newHeight = this.collapsedHeight
      const newX = Math.round(Math.min(
        Math.max(currentPos[0] + this.expandedWidth / 2 - newWidth / 2, 0),
        screenWidth - newWidth
      ))
      const newY = 0 // 紧贴屏幕顶部

      this.window.setBounds({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      })
    }

    // 通知渲染进程状态变更
    this.window.webContents.send('window:expand-changed', expanded)
  }

  /**
   * 检查并执行贴边吸附
   */
  private checkEdgeSnap(): void {
    if (!this.window) return

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    const [x, y] = this.window.getPosition()
    const [width, height] = this.window.getSize()

    let snapped = false

    // 检测是否靠近各边缘
    if (y <= this.snapThreshold) {
      // 贴顶部
      this.window.setPosition(x, 0)
      this.dockPosition = 'top'
      snapped = true
    } else if (y + height >= screenHeight - this.snapThreshold) {
      // 贴底部
      this.window.setPosition(x, screenHeight - height)
      this.dockPosition = 'bottom'
      snapped = true
    } else if (x <= this.snapThreshold) {
      // 贴左边
      this.window.setPosition(0, y)
      this.dockPosition = 'left'
      snapped = true
    } else if (x + width >= screenWidth - this.snapThreshold) {
      // 贴右边
      this.window.setPosition(screenWidth - width, y)
      this.dockPosition = 'right'
      snapped = true
    }

    if (snapped) {
      this.window.webContents.send('window:dock', this.dockPosition)
    } else {
      this.dockPosition = 'none'
    }
  }

  /**
   * 主动贴边
   */
  dockToEdge(position: 'top' | 'bottom' | 'left' | 'right' | 'none'): void {
    if (!this.window || position === 'none') return

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    const [width, height] = this.window.getSize()

    let x = 0, y = 0

    switch (position) {
      case 'top':
        x = Math.round((screenWidth - width) / 2)
        y = 0
        break
      case 'bottom':
        x = Math.round((screenWidth - width) / 2)
        y = screenHeight - height
        break
      case 'left':
        x = 0
        y = Math.round((screenHeight - height) / 2)
        break
      case 'right':
        x = screenWidth - width
        y = Math.round((screenHeight - height) / 2)
        break
    }

    this.window.setPosition(x, y)
    this.dockPosition = position
  }

  /**
   * 获取窗口实例
   */
  getWindow(): BrowserWindow | null {
    return this.window
  }

  /**
   * 销毁窗口
   */
  destroy(): void {
    if (this.window) {
      this.window.destroy()
      this.window = null
    }
  }
}
