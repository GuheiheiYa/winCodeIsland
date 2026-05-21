import { ipcMain, BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import type { AppSettings, DockPosition, Session } from '../../src/types'
import { SessionManager } from '../services/sessionManager'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const koffi = require('koffi') as {
  load: (name: string) => {
    func: (def: string) => (...args: unknown[]) => unknown
  }
}

const user32 = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

const ShowWindow = user32.func('bool __stdcall ShowWindow(void * hWnd, int32 nCmdShow)')
const SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(void * hWnd)')
const IsIconic = user32.func('bool __stdcall IsIconic(void * hWnd)')
const IsWindow = user32.func('bool __stdcall IsWindow(void * hWnd)')
const GetForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()')
const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void * hWnd, _Out_ uint32 * lpdwProcessId)')
const AttachThreadInput = user32.func('bool __stdcall AttachThreadInput(uint32 idAttach, uint32 idAttachTo, bool fAttach)')
const GetCurrentThreadId = kernel32.func('uint32 __stdcall GetCurrentThreadId()')
const BringWindowToTop = user32.func('bool __stdcall BringWindowToTop(void * hWnd)')

// 快速窗口枚举 API（无需回调）
const GetDesktopWindow = user32.func('void * __stdcall GetDesktopWindow()')
const GetWindow = user32.func('void * __stdcall GetWindow(void * hWnd, uint32 uCmd)')
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(void * hWnd)')
const FreeConsole = kernel32.func('bool __stdcall FreeConsole()')
const AttachConsole = kernel32.func('bool __stdcall AttachConsole(uint32 dwProcessId)')
const GetConsoleWindow = kernel32.func('void * __stdcall GetConsoleWindow()')

const SW_RESTORE = 9
const GW_CHILD = 5
const GW_HWNDNEXT = 2

// ============================================================================
// 极速终端聚焦 — 纯 Win32 API，无 PowerShell，无缓存，无延迟
// ============================================================================

/** 遍历所有顶层可见窗口，查找属于 targetPid 的窗口句柄 */
function findVisibleHwndByPid(targetPid: number): bigint | null {
  const desktop = GetDesktopWindow() as unknown
  if (!desktop) return null

  let hwnd = GetWindow(desktop, GW_CHILD) as unknown
  while (hwnd) {
    if (IsWindowVisible(hwnd as unknown)) {
      const pidArr = new Uint32Array(1)
      GetWindowThreadProcessId(hwnd as unknown, pidArr)
      if (pidArr[0] === targetPid) {
        return BigInt(Number(hwnd as unknown))
      }
    }
    hwnd = GetWindow(hwnd, GW_HWNDNEXT) as unknown
  }
  return null
}

/** 附加到 pid 所属的控制台并获取其窗口句柄 */
function getConsoleHwndByPid(pid: number): bigint | null {
  FreeConsole()
  const attached = AttachConsole(pid) as unknown as boolean
  if (!attached) return null
  const hwnd = GetConsoleWindow() as unknown
  FreeConsole()
  return hwnd ? BigInt(Number(hwnd as unknown)) : null
}

/** 使用 AttachThreadInput 技巧立即激活窗口 */
function activateWindow(hwnd: bigint): void {
  if (!IsWindow(hwnd as unknown)) return

  if (IsIconic(hwnd as unknown)) {
    ShowWindow(hwnd as unknown, SW_RESTORE)
  }

  const currentThreadId = GetCurrentThreadId() as unknown as number
  const fgHwnd = GetForegroundWindow() as unknown
  const fgThreadId = fgHwnd
    ? Number(GetWindowThreadProcessId(fgHwnd, null))
    : currentThreadId

  if (fgThreadId !== currentThreadId) {
    AttachThreadInput(currentThreadId, fgThreadId, true)
  }

  SetForegroundWindow(hwnd as unknown)
  BringWindowToTop(hwnd as unknown)

  if (fgThreadId !== currentThreadId) {
    AttachThreadInput(currentThreadId, fgThreadId, false)
  }
}

/** 通过 WMIC 轻量查询父进程链（比 PowerShell 更快） */
function getParentChain(
  pid: number,
  depth = 0
): Promise<Array<{ pid: number; name: string }>> {
  if (depth > 6) return Promise.resolve([])

  return new Promise((resolve) => {
    execFile(
      'wmic',
      ['process', 'where', `ProcessId=${pid}`, 'get', 'ProcessId,ParentProcessId,Name', '/FORMAT:CSV'],
      { windowsHide: true, timeout: 2000 },
      (err, stdout) => {
        if (err) {
          resolve([])
          return
        }

        const lines = stdout
          .trim()
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('Node') && l.includes(','))

        if (lines.length === 0) {
          resolve([])
          return
        }

        const parts = lines[0].split(',')
        if (parts.length < 4) {
          resolve([])
          return
        }

        const processId = parseInt(parts[1], 10)
        const parentPid = parseInt(parts[2], 10)
        const name = parts[3]

        const entry = { pid: processId, name }
        const lowerName = name.toLowerCase()

        // 遇到终端宿主进程时停止回溯
        if (
          lowerName.includes('windowsterminal') ||
          lowerName === 'cmd.exe' ||
          lowerName === 'powershell.exe' ||
          lowerName === 'pwsh.exe' ||
          lowerName === 'conhost.exe' ||
          lowerName === 'openconsole.exe'
        ) {
          resolve([entry])
          return
        }

        getParentChain(parentPid, depth + 1).then((rest) => {
          resolve([entry, ...rest])
        })
      }
    )
  })
}

/** 根据 pid 查找并激活对应的终端窗口 */
function focusTerminal(mainWindow: BrowserWindow, pid: number): void {
  if (process.platform !== 'win32' || !pid) return

  // 第一层：直接匹配可见窗口（最快，~1-10ms）
  let hwnd = findVisibleHwndByPid(pid)
  if (hwnd) {
    activateWindow(hwnd)
    return
  }

  // 第二层：通过 AttachConsole 获取控制台窗口（~5-20ms）
  hwnd = getConsoleHwndByPid(pid)
  if (hwnd) {
    activateWindow(hwnd)
    return
  }

  // 第三层：异步回溯父进程链兜底（~50-200ms）
  getParentChain(pid).then((chain) => {
    for (const entry of chain) {
      const ancestorHwnd = findVisibleHwndByPid(entry.pid)
      if (ancestorHwnd) {
        activateWindow(ancestorHwnd)
        return
      }
      const ancestorConsole = getConsoleHwndByPid(entry.pid)
      if (ancestorConsole) {
        activateWindow(ancestorConsole)
        return
      }
    }
  })
}

/** Windows Terminal 标签切换（预留） */
function focusWTTab(): void {
  // TODO: 通过 UIAutomation 切换 WT 标签页
}

// ============================================================================
// IPC 处理器
// ============================================================================

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

export function setSessionManager(manager: SessionManager): void {
  sessionManager = manager
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.on('window:toggle-expand', () => {
    mainWindow.webContents.send('window:toggle-expand')
  })

  ipcMain.on('window:set-expanded', (_event, expanded: boolean) => {
    mainWindow.webContents.send('window:expand-changed', expanded)
  })

  ipcMain.on('window:dock', (_event, position: DockPosition) => {
    mainWindow.webContents.send('window:dock', position)
  })

  ipcMain.on('window:show', () => {
    mainWindow.show()
    mainWindow.setSkipTaskbar(true)
  })

  ipcMain.on('window:hide', () => {
    mainWindow.hide()
  })

  ipcMain.handle('settings:get', () => currentSettings)

  ipcMain.on('settings:set', (_event, settings: AppSettings) => {
    currentSettings = { ...settings }
    mainWindow.webContents.send('settings:changed', currentSettings)
  })

  ipcMain.on('app:quit', () => {
    mainWindow.close()
  })

  ipcMain.on('window:set-mouse-ignore', (_event, ignore: boolean) => {
    if (process.platform === 'win32') {
      mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })

  ipcMain.handle('session:create', () => {
    throw new Error('Manual session creation is disabled. Sessions are auto-discovered from Claude Code logs.')
  })

  ipcMain.on('session:kill', () => {
    // Sessions are auto-discovered from CLI state files.
  })

  ipcMain.on('terminal:focus', (_event, pid: number) => {
    focusTerminal(mainWindow, pid)
  })
}

export function updateSessions(mainWindow: BrowserWindow, sessions: unknown): void {
  mainWindow.webContents.send('sessions:update', sessions)
}

export function getSettings(): AppSettings {
  return { ...currentSettings }
}
