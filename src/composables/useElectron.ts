import { onMounted, onUnmounted } from 'vue'
import type { Session, AppSettings } from '../types'

/**
 * Electron API 封装
 * 提供安全的 Electron 主进程通信接口
 */

/**
 * 切换窗口展开/收起
 */
export function toggleExpand(): void {
  window.electronAPI?.toggleExpand?.()
}

/**
 * 设置窗口展开状态
 */
export function setExpanded(expanded: boolean): void {
  window.electronAPI?.setExpanded?.(expanded)
}

/**
 * 贴边窗口
 */
export function dockWindow(position: 'top' | 'bottom' | 'left' | 'right' | 'none'): void {
  window.electronAPI?.dockWindow?.(position)
}

/**
 * 显示窗口
 */
export function showWindow(): void {
  window.electronAPI?.showWindow?.()
}

/**
 * 隐藏窗口
 */
export function hideWindow(): void {
  window.electronAPI?.hideWindow?.()
}

/**
 * 退出应用
 */
export function quitApp(): void {
  window.electronAPI?.quitApp?.()
}

/**
 * 获取设置
 */
export async function getSettings(): Promise<AppSettings | null> {
  if (!window.electronAPI?.getSettings) return null
  try {
    return await window.electronAPI.getSettings()
  } catch {
    return null
  }
}

/**
 * 保存设置
 */
export function setSettings(settings: AppSettings): void {
  window.electronAPI?.setSettings?.(settings)
}

/**
 * 监听会话更新
 */
export function onSessionsUpdate(callback: (sessions: Session[]) => void): (() => void) | undefined {
  if (!window.electronAPI?.onSessionsUpdate) return undefined
  return window.electronAPI.onSessionsUpdate(callback)
}

/**
 * 监听设置变更
 */
export function onSettingsChanged(callback: (settings: AppSettings) => void): (() => void) | undefined {
  if (!window.electronAPI?.onSettingsChanged) return undefined
  return window.electronAPI.onSettingsChanged(callback)
}

/**
 * 监听展开状态变更
 */
export function onExpandChanged(callback: (expanded: boolean) => void): (() => void) | undefined {
  if (!window.electronAPI?.onExpandChanged) return undefined
  return window.electronAPI.onExpandChanged(callback)
}

/**
 * 获取平台信息
 */
export function getPlatform(): string {
  return window.electronAPI?.platform || 'unknown'
}

/**
 * 检查是否在 Electron 环境中运行
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

/**
 * Composable: 使用 Electron IPC 监听
 */
export function useElectronIpc(
  onSessions?: (sessions: Session[]) => void,
  onSettings?: (settings: AppSettings) => void,
  onExpand?: (expanded: boolean) => void
) {
  let unsubs: (() => void)[] = []

  onMounted(() => {
    if (onSessions) {
      const unsub = onSessionsUpdate(onSessions)
      if (unsub) unsubs.push(unsub)
    }
    if (onSettings) {
      const unsub = onSettingsChanged(onSettings)
      if (unsub) unsubs.push(unsub)
    }
    if (onExpand) {
      const unsub = onExpandChanged(onExpand)
      if (unsub) unsubs.push(unsub)
    }
  })

  onUnmounted(() => {
    unsubs.forEach((unsub) => unsub())
    unsubs = []
  })

  return {
    isElectron: isElectron(),
    platform: getPlatform()
  }
}
