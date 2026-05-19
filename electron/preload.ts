import { contextBridge, ipcRenderer } from 'electron'
import type { Session, AppSettings, DockPosition } from '../src/types'

/**
 * Preload 脚本 - 安全地暴露 Electron API 到渲染进程
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  toggleExpand: () => ipcRenderer.send('window:toggle-expand'),
  setExpanded: (expanded: boolean) => ipcRenderer.send('window:set-expanded', expanded),
  dockWindow: (position: DockPosition) => ipcRenderer.send('window:dock', position),
  showWindow: () => ipcRenderer.send('window:show'),
  hideWindow: () => ipcRenderer.send('window:hide'),
  quitApp: () => ipcRenderer.send('app:quit'),

  // 会话数据
  onSessionsUpdate: (callback: (sessions: Session[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, sessions: Session[]) => callback(sessions)
    ipcRenderer.on('sessions:update', handler)
    return () => ipcRenderer.removeListener('sessions:update', handler)
  },

  // 设置
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: AppSettings) => ipcRenderer.send('settings:set', settings),
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    const handler = (_: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings)
    ipcRenderer.on('settings:changed', handler)
    return () => ipcRenderer.removeListener('settings:changed', handler)
  },

  // 展开状态
  onExpandChanged: (callback: (expanded: boolean) => void) => {
    const handler = (_: Electron.IpcRendererEvent, expanded: boolean) => callback(expanded)
    ipcRenderer.on('window:expand-changed', handler)
    return () => ipcRenderer.removeListener('window:expand-changed', handler)
  },

  // 鼠标穿透（透明区域点击穿透到下方窗口）
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('window:set-mouse-ignore', ignore),

  // 平台信息
  platform: process.platform
})
