import { ipcMain, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { AppSettings, DockPosition } from '../../src/types'
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
const GetForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()')
const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void * hWnd, _Out_ uint32 * lpdwProcessId)')
const AttachThreadInput = user32.func('bool __stdcall AttachThreadInput(uint32 idAttach, uint32 idAttachTo, bool fAttach)')
const GetCurrentThreadId = kernel32.func('uint32 __stdcall GetCurrentThreadId()')
const BringWindowToTop = user32.func('bool __stdcall BringWindowToTop(void * hWnd)')

const SW_RESTORE = 9
const SW_SHOW = 5

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

  // 聚焦终端窗口（通过 PID 激活对应的终端进程）
  ipcMain.on('terminal:focus', (_event, pid: number) => {
    console.log('[terminal:focus] handler triggered, pid=', pid)
    if (process.platform !== 'win32' || !pid) return


    // PowerShell 负责：1) 检测终端类型 (WT vs CMD)  2) 找到窗口句柄  3) 找到 WT 标签页索引
    const psScript = `
$targetPid = ${pid}

# 1. 先检查是否是 Windows Terminal（通过进程树检测）
$wtProcs = Get-Process WindowsTerminal -ErrorAction SilentlyContinue
$isWt = $false
$wtHwnd = 0
if ($wtProcs) {
    $currentPid = $targetPid
    $maxIter = 50
    $iter = 0
    while ($currentPid -ne 0 -and $iter -lt $maxIter) {
        $iter++
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$currentPid" -ErrorAction SilentlyContinue
        if (-not $proc) { break }
        $parent = $proc.ParentProcessId
        if ($parent -eq 0 -or $parent -eq $currentPid) { break }
        $parentProc = Get-Process -Id $parent -ErrorAction SilentlyContinue
        if ($parentProc -and ($parentProc.ProcessName -eq "WindowsTerminal" -or $parentProc.ProcessName -eq "OpenConsole" -or $parentProc.ProcessName -eq "conhost")) {
            # 找到了 WT 相关的祖先，说明目标 PID 在 WT 中
            $isWt = $true
            break
        }
        $currentPid = $parent
    }
    if ($isWt) {
        $wtProc = $wtProcs | Select-Object -First 1
        $wtHwnd = if ($wtProc -and $wtProc.MainWindowHandle) { $wtProc.MainWindowHandle.ToInt64() } else { 0 }
    }
}

if ($isWt -and $wtHwnd -ne 0) {
    # ===== Windows Terminal 路径 =====
    # 找到所有 WT 标签页的根进程（OpenConsole/conhost），按创建时间排序
    $allOcs = Get-Process OpenConsole -ErrorAction SilentlyContinue
    if (-not $allOcs) { $allOcs = Get-Process conhost -ErrorAction SilentlyContinue }
    $activeOcs = @()
    if ($allOcs) {
        foreach ($oc in $allOcs) {
            $children = (Get-CimInstance Win32_Process -Filter "ParentProcessId=$($oc.Id)" -ErrorAction SilentlyContinue).ProcessId
            if ($children -and $children.Count -gt 0) {
                $activeOcs += $oc
            }
        }
    }
    $activeOcs = $activeOcs | Sort-Object StartTime

    # 通过进程树找到目标标签页索引
    $foundIndex = -1
    if ($activeOcs) {
        $idx = 0
        foreach ($oc in $activeOcs) {
            $queue = [System.Collections.Generic.Queue[int]]::new()
            $queue.Enqueue($oc.Id)
            $found = $false
            $maxIter2 = 200
            $iter2 = 0
            while ($queue.Count -gt 0 -and -not $found -and $iter2 -lt $maxIter2) {
                $iter2++
                $current = $queue.Dequeue()
                if ($current -eq $targetPid) {
                    $found = $true
                    break
                }
                $children = (Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" -ErrorAction SilentlyContinue).ProcessId
                if ($children) {
                    foreach ($child in $children) { $queue.Enqueue($child) }
                }
            }
            if ($found) {
                $foundIndex = $idx
                break
            }
            $idx++
        }
    }

    "hwnd=$wtHwnd,index=$foundIndex,type=wt"
} else {
    # ===== 传统 CMD / 其他终端路径 =====
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
        public static IntPtr FindHwndByPid(int targetPid) {
            IntPtr result = IntPtr.Zero;
            EnumWindows((hWnd, lParam) => {
                if (!IsWindowVisible(hWnd)) return true;
                uint p; GetWindowThreadProcessId(hWnd, out p);
                if (p == targetPid) { result = hWnd; return false; }
                return true;
            }, IntPtr.Zero);
            return result;
        }
    }
"@

    # 调试：打印进程树到 stderr
    [Console]::Error.WriteLine("=== process tree for PID $targetPid ===")
    $treePid = $targetPid
    $treeIter = 0
    while ($treePid -ne 0 -and $treeIter -lt 20) {
        $treeIter++
        $treeProc = Get-CimInstance Win32_Process -Filter "ProcessId=$treePid" -ErrorAction SilentlyContinue
        if (-not $treeProc) { [Console]::Error.WriteLine("PID=$treePid NOT FOUND"); break }
        [Console]::Error.WriteLine("PID=$treePid Name=$($treeProc.Name)")
        $treeParent = $treeProc.ParentProcessId
        if ($treeParent -eq 0 -or $treeParent -eq $treePid) { break }
        $treePid = $treeParent
    }
    [Console]::Error.WriteLine("=== end process tree ===")

    $hwnd = [IntPtr]::Zero

    # 第一步：先找目标 PID 自身的窗口
    $hwnd = [Win32]::FindHwndByPid($targetPid)

    # 第二步：向上遍历进程树，找终端父进程的窗口
    # 同时记录控制台进程 PID 用于 AttachConsole 回退
    $consolePid = 0
    $validTerms = @("cmd","powershell","pwsh","bash","WindowsTerminal","OpenConsole","conhost")
    if ($hwnd -eq [IntPtr]::Zero) {
        $p = $targetPid
        $maxIter = 50
        $iter = 0
        while ($p -ne 0 -and $hwnd -eq [IntPtr]::Zero -and $iter -lt $maxIter) {
            $iter++
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue
            if (-not $proc) { [Console]::Error.WriteLine("traverse: PID=$p not found"); break }
            $procName = $proc.Name
            # CIM returns Name with .exe suffix, strip it for matching
            if ($procName.EndsWith(".exe")) { $procName = $procName.Substring(0, $procName.Length - 4) }
            $parent = $proc.ParentProcessId
            [Console]::Error.WriteLine("traverse: PID=$p Name=$procName parent=$parent")
            if ($parent -eq $p -or $parent -eq 0) { break }
            if ($validTerms -contains $procName) {
                # 记录控制台进程 PID（如 cmd.exe），窗口归 conhost.exe 所有
                # FindHwndByPid 返回 0，后续用 AttachConsole 回退
                $testHwnd = [Win32]::FindHwndByPid($p)
                [Console]::Error.WriteLine("traverse: testing hwnd for $procName = $testHwnd")
                if ($testHwnd -ne [IntPtr]::Zero) {
                    $hwnd = $testHwnd
                    [Console]::Error.WriteLine("traverse: FOUND hwnd=$($hwnd.ToInt64()) for $procName")
                    break
                }
                # 记录控制台进程 PID，用于后续 AttachConsole 回退
                if ($procName -eq "cmd" -or $procName -eq "powershell" -or $procName -eq "pwsh") {
                    $consolePid = $p
                }
            }
            $p = $parent
        }
    }

    # 第三步：对于 CMD/PowerShell，conhost.exe 是兄弟进程不是父进程
    # 进程树遍历找不到它。使用 AttachConsole + GetConsoleWindow API
    # 直接从控制台宿主获取窗口句柄
    if ($hwnd -eq [IntPtr]::Zero -and $consolePid -ne 0) {
        [Console]::Error.WriteLine("attaching to console of PID=$consolePid")
        $tempOut = [System.IO.Path]::GetTempFileName()
        $helper = @'
param($targetId, $outFile)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ConsoleWin {
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool FreeConsole();
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool AttachConsole(uint dwProcessId);
    [DllImport("kernel32.dll")]
    public static extern IntPtr GetConsoleWindow();
}
"@
try {
    [ConsoleWin]::FreeConsole() | Out-Null
    if ([ConsoleWin]::AttachConsole($targetId)) {
        [System.IO.File]::WriteAllText($outFile, [ConsoleWin]::GetConsoleWindow().ToInt64().ToString())
        [ConsoleWin]::FreeConsole() | Out-Null
    } else {
        [System.IO.File]::WriteAllText($outFile, "0")
    }
} catch {
    [System.IO.File]::WriteAllText($outFile, "0")
}
'@
        powershell -NoProfile -NonInteractive -Command "$helper" -args $consolePid, $tempOut 2>$null | Out-Null
        $attachedHwndStr = Get-Content $tempOut -Raw 2>$null
        Remove-Item $tempOut -ErrorAction SilentlyContinue
        if ($attachedHwndStr) {
            $attachedHwnd = [long]$attachedHwndStr.Trim()
            [Console]::Error.WriteLine("AttachConsole result: hwnd=$attachedHwnd")
            if ($attachedHwnd -gt 0) {
                $hwnd = [IntPtr]::new($attachedHwnd)
            }
        }
    }

    if ($hwnd -ne [IntPtr]::Zero) {
        "hwnd=$($hwnd.ToInt64()),index=-1,type=cmd"
    } else {
        "hwnd=0,index=-1,type=none"
    }
}
`

    const scriptPath = path.join(os.tmpdir(), 'vibe-notch-focus.ps1')
    fs.writeFileSync(scriptPath, '﻿' + psScript, 'utf16le')
    console.log('[terminal:focus] script written to', scriptPath, 'size=', fs.statSync(scriptPath).size)

    console.log('[terminal:focus] about to exec PowerShell')
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, { windowsHide: true, timeout: 10000 }, (err: Error | null, stdout: string, stderr: string) => {
      console.log('[terminal:focus] exec callback triggered')
      if (stderr) {
        console.error('[terminal:focus] PowerShell stderr:', stderr)
      }
      if (err) {
        console.error('[terminal:focus] PowerShell error:', err.message)
        return
      }

      // 解析输出: hwnd=xxx,index=xxx,type=wt|cmd|none
      const match = stdout.trim().match(/hwnd=(\d+),index=(-?\d+),type=(\w+)/)
      if (!match) {
        console.error('[terminal:focus] unexpected output:', stdout.trim())
        return
      }

      const hwnd = BigInt(match[1])
      const tabIndex = parseInt(match[2], 10)
      const termType = match[3]

      if (!hwnd || termType === 'none') {
        console.error('[terminal:focus] no hwnd found, type=', termType)
        return
      }

      console.log(`[terminal:focus] pid=${pid} hwnd=${hwnd.toString()} type=${termType} index=${tabIndex}`)

      const notchWindow = BrowserWindow.fromId(mainWindow.id)

      // 方案：临时取消置顶 + blur 让出焦点 → 激活目标 → 延迟恢复置顶
      if (notchWindow) {
        notchWindow.setAlwaysOnTop(false)
        notchWindow.blur()
      }

      // 1. 恢复最小化窗口
      const iconic = IsIconic(hwnd)
      console.log(`[terminal:focus] IsIconic=${iconic}`)
      if (iconic) {
        const swResult = ShowWindow(hwnd, SW_RESTORE)
        console.log(`[terminal:focus] ShowWindow(SW_RESTORE) result=${swResult}`)
      }

      // 2. 激活窗口 — 使用 AttachThreadInput 绕过 Windows 前景权限限制
      // Windows 只允许前台进程或附加到前台线程的进程调用 SetForegroundWindow
      const currentThreadId = GetCurrentThreadId() as unknown as number
      const fgHwnd = GetForegroundWindow() as unknown
      let fgThreadId = currentThreadId
      if (fgHwnd) {
        fgThreadId = Number(GetWindowThreadProcessId(fgHwnd, null))
      }

      // 附加当前线程到前景窗口的输入队列
      if (fgThreadId !== currentThreadId) {
        AttachThreadInput(currentThreadId, fgThreadId, true)
      }

      const fgResult = SetForegroundWindow(hwnd as unknown)
      const bttResult = BringWindowToTop(hwnd as unknown)

      if (fgThreadId !== currentThreadId) {
        AttachThreadInput(currentThreadId, fgThreadId, false)
      }
      console.log(`[terminal:focus] SetForegroundWindow=${fgResult} BringWindowToTop=${bttResult}`)

      // 3. Windows Terminal: 切换到对应标签页
      if (termType === 'wt' && tabIndex >= 0) {
        exec(`wt focus-tab -t ${tabIndex}`, { windowsHide: true }, (wtErr: Error | null) => {
          if (wtErr) {
            console.error('[terminal:focus] wt focus-tab error:', wtErr.message)
          } else {
            console.log(`[terminal:focus] wt focus-tab -t ${tabIndex} sent`)
          }
        })
      }

      // 4. 800ms 后恢复 Electron 置顶
      setTimeout(() => {
        if (notchWindow) {
          notchWindow.setAlwaysOnTop(true, 'screen-saver')
        }
      }, 800)
    })
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
