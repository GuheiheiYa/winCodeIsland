import { ipcMain, BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
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

const SW_RESTORE = 9
const CACHE_TTL = 5 * 60 * 1000
const PRIME_INTERVAL = 5000

interface FocusCacheEntry {
  hwnd: bigint
  tabIndex: number
  termType: 'wt' | 'cmd'
  ts: number
}

interface ResolvedTerminalTarget {
  pid: number
  hwnd: number
  tabIndex: number
  termType: 'wt' | 'cmd' | 'none'
}

const focusCache = new Map<number, FocusCacheEntry>()
const resolvingPids = new Set<number>()
let lastPrimeAt = 0

function getCachedFocus(pid: number): FocusCacheEntry | null {
  const entry = focusCache.get(pid)
  if (!entry) return null

  const isFresh = Date.now() - entry.ts <= CACHE_TTL
  const isStillWindow = Boolean(IsWindow(entry.hwnd as unknown))
  if (!isFresh || !isStillWindow) {
    focusCache.delete(pid)
    return null
  }

  return entry
}

function setCachedFocus(result: ResolvedTerminalTarget): void {
  if (result.termType === 'none' || result.hwnd <= 0) return
  focusCache.set(result.pid, {
    hwnd: BigInt(result.hwnd),
    tabIndex: result.tabIndex,
    termType: result.termType,
    ts: Date.now()
  })
}

function activateTerminal(
  mainWindow: BrowserWindow,
  hwnd: bigint,
  tabIndex: number,
  termType: string
): void {
  if (!IsWindow(hwnd as unknown)) {
    console.warn('[terminal:focus] cached hwnd is no longer valid:', hwnd.toString())
    return
  }

  mainWindow.setAlwaysOnTop(false)
  mainWindow.blur()

  const bringToFront = (): void => {
    if (IsIconic(hwnd as unknown)) {
      ShowWindow(hwnd as unknown, SW_RESTORE)
    }

    const currentThreadId = GetCurrentThreadId() as unknown as number
    const foregroundHwnd = GetForegroundWindow() as unknown
    const foregroundThreadId = foregroundHwnd
      ? Number(GetWindowThreadProcessId(foregroundHwnd, null))
      : currentThreadId

    if (foregroundThreadId !== currentThreadId) {
      AttachThreadInput(currentThreadId, foregroundThreadId, true)
    }

    const foregroundResult = SetForegroundWindow(hwnd as unknown)
    BringWindowToTop(hwnd as unknown)

    if (foregroundThreadId !== currentThreadId) {
      AttachThreadInput(currentThreadId, foregroundThreadId, false)
    }

    console.log(`[terminal:focus] foreground=${foregroundResult} hwnd=${hwnd.toString()}`)

    if (termType === 'wt' && tabIndex >= 0) {
      setTimeout(() => {
        execFile('wt', ['-w', '0', 'focus-tab', '--target', String(tabIndex)], { windowsHide: true }, (err) => {
          if (err) {
            console.warn('[terminal:focus] wt focus-tab failed:', err.message)
          }
        })
      }, 120)
    }

    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver')
      }
    }, 800)
  }

  if (IsIconic(hwnd as unknown)) {
    ShowWindow(hwnd as unknown, SW_RESTORE)
    setTimeout(bringToFront, 120)
  } else {
    bringToFront()
  }
}

function resolveTerminalTargets(pids: number[]): Promise<ResolvedTerminalTarget[]> {
  const uniquePids = Array.from(new Set(pids.filter((pid) => Number.isInteger(pid) && pid > 0)))
  const pidsToResolve = uniquePids.filter((pid) => !resolvingPids.has(pid))
  if (pidsToResolve.length === 0) return Promise.resolve([])

  for (const pid of pidsToResolve) {
    resolvingPids.add(pid)
  }

  const psScript = `
param([string]$TargetPidList)
$targetPids = @($TargetPidList -split ',' | Where-Object { $_ } | ForEach-Object { [int]$_ })
$results = @()

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class VibeWin32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool FreeConsole();
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AttachConsole(uint dwProcessId);
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  public static IntPtr FindVisibleHwndByPid(int targetPid) {
    IntPtr result = IntPtr.Zero;
    EnumWindows((hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      uint p;
      GetWindowThreadProcessId(hWnd, out p);
      if (p == targetPid) {
        result = hWnd;
        return false;
      }
      return true;
    }, IntPtr.Zero);
    return result;
  }
  public static IntPtr GetConsoleHwnd(int consolePid) {
    try {
      FreeConsole();
      if (!AttachConsole((uint)consolePid)) return IntPtr.Zero;
      IntPtr hwnd = GetConsoleWindow();
      FreeConsole();
      return hwnd;
    } catch {
      return IntPtr.Zero;
    }
  }
}
"@

$processMap = @{}
$childrenMap = @{}
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
  $name = [string]$_.Name
  if ($name.EndsWith(".exe")) { $name = $name.Substring(0, $name.Length - 4) }
  $processId = [int]$_.ProcessId
  $parent = [int]$_.ParentProcessId
  $info = [pscustomobject]@{ Pid = $processId; Parent = $parent; Name = $name }
  $processMap[$processId] = $info
  if (-not $childrenMap.ContainsKey($parent)) {
    $childrenMap[$parent] = [System.Collections.Generic.List[int]]::new()
  }
  $childrenMap[$parent].Add($processId)
}

$getProcessMap = @{}
Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
  $getProcessMap[[int]$_.Id] = $_
}

function Get-Ancestors([int]$TargetProcessId) {
  $items = @()
  $seen = @{}
  $current = $TargetProcessId
  for ($i = 0; $i -lt 80; $i++) {
    if ($current -le 0 -or $seen.ContainsKey($current) -or -not $processMap.ContainsKey($current)) { break }
    $seen[$current] = $true
    $proc = $processMap[$current]
    $items += $proc
    if ($proc.Parent -eq $current) { break }
    $current = $proc.Parent
  }
  return $items
}

function Test-TreeContains([int]$RootPid, [int]$TargetPid) {
  if ($RootPid -eq $TargetPid) { return $true }
  $queue = [System.Collections.Generic.Queue[int]]::new()
  $queue.Enqueue($RootPid)
  $seen = @{}
  while ($queue.Count -gt 0) {
    $currentProcessId = $queue.Dequeue()
    if ($seen.ContainsKey($currentProcessId)) { continue }
    $seen[$currentProcessId] = $true
    if ($currentProcessId -eq $TargetPid) { return $true }
    if ($childrenMap.ContainsKey($currentProcessId)) {
      foreach ($child in $childrenMap[$currentProcessId]) { $queue.Enqueue($child) }
    }
  }
  return $false
}

foreach ($targetPid in $targetPids) {
  $hwnd = 0
  $tabIndex = -1
  $termType = "none"
  $ancestors = @(Get-Ancestors $targetPid)
  $wtAncestor = $ancestors | Where-Object { $_.Name -eq "WindowsTerminal" -or $_.Name -eq "WindowsTerminalPreview" } | Select-Object -First 1

  if ($wtAncestor -and $getProcessMap.ContainsKey($wtAncestor.Pid)) {
    $wtProc = $getProcessMap[$wtAncestor.Pid]
    if ($wtProc.MainWindowHandle) { $hwnd = $wtProc.MainWindowHandle.ToInt64() }
    $termType = "wt"

    $consoleRoots = @()
    if ($childrenMap.ContainsKey($wtAncestor.Pid)) {
      foreach ($childPid in $childrenMap[$wtAncestor.Pid]) {
        if (-not $processMap.ContainsKey($childPid) -or -not $getProcessMap.ContainsKey($childPid)) { continue }
        $child = $processMap[$childPid]
        if ($child.Name -eq "OpenConsole" -or $child.Name -eq "conhost") {
          $consoleRoots += $getProcessMap[$childPid]
        }
      }
    }

    $consoleRoots = @($consoleRoots | Sort-Object StartTime)
    for ($i = 0; $i -lt $consoleRoots.Count; $i++) {
      if (Test-TreeContains ([int]$consoleRoots[$i].Id) $targetPid) {
        $tabIndex = $i
        break
      }
    }
  } else {
    $visible = [VibeWin32]::FindVisibleHwndByPid($targetPid)
    if ($visible -ne [IntPtr]::Zero) {
      $hwnd = $visible.ToInt64()
      $termType = "cmd"
    } else {
      $consolePid = 0
      foreach ($ancestor in $ancestors) {
        if ($ancestor.Name -eq "cmd" -or $ancestor.Name -eq "powershell" -or $ancestor.Name -eq "pwsh" -or $ancestor.Name -eq "conhost") {
          $candidate = [VibeWin32]::FindVisibleHwndByPid($ancestor.Pid)
          if ($candidate -ne [IntPtr]::Zero) {
            $hwnd = $candidate.ToInt64()
            $termType = "cmd"
            break
          }
          if ($consolePid -eq 0) { $consolePid = $ancestor.Pid }
        }
      }

      if ($hwnd -eq 0 -and $consolePid -gt 0) {
        $consoleHwnd = [VibeWin32]::GetConsoleHwnd($consolePid)
        if ($consoleHwnd -ne [IntPtr]::Zero) {
          $hwnd = $consoleHwnd.ToInt64()
          $termType = "cmd"
        }
      }
    }
  }

  $results += [pscustomobject]@{
    pid = $targetPid
    hwnd = [long]$hwnd
    tabIndex = [int]$tabIndex
    termType = $termType
  }
}

@($results) | ConvertTo-Json -Compress
`

  const scriptPath = path.join(os.tmpdir(), 'vibe-notch-focus-resolver.ps1')
  fs.writeFileSync(scriptPath, psScript, 'utf8')

  return new Promise((resolve) => {
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        pidsToResolve.join(',')
      ],
      { windowsHide: true, timeout: 8000 },
      (err, stdout, stderr) => {
        for (const pid of pidsToResolve) resolvingPids.delete(pid)

        if (stderr) {
          console.warn('[terminal:focus] resolver stderr:', stderr.trim())
        }
        if (err) {
          console.warn('[terminal:focus] resolver failed:', err.message)
          resolve([])
          return
        }

        try {
          const parsed = JSON.parse(stdout.trim() || '[]') as ResolvedTerminalTarget[] | ResolvedTerminalTarget
          const results = Array.isArray(parsed) ? parsed : [parsed]
          for (const result of results) setCachedFocus(result)
          resolve(results)
        } catch (parseErr) {
          console.warn('[terminal:focus] resolver returned invalid JSON:', stdout.trim(), parseErr)
          resolve([])
        }
      }
    )
  })
}

export function primeTerminalFocusCache(sessions: Session[]): void {
  if (process.platform !== 'win32') return

  const now = Date.now()
  if (now - lastPrimeAt < PRIME_INTERVAL) return
  lastPrimeAt = now

  const pids = sessions
    .map((session) => session.pid)
    .filter((pid): pid is number => typeof pid === 'number' && pid > 0)
    .filter((pid) => !getCachedFocus(pid))

  if (pids.length === 0) return

  resolveTerminalTargets(pids).catch((err) => {
    console.warn('[terminal:focus] background cache prime failed:', err)
  })
}

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
    if (process.platform !== 'win32' || !pid) return

    const cached = getCachedFocus(pid)
    if (cached) {
      console.log(`[terminal:focus] cache hit pid=${pid} hwnd=${cached.hwnd.toString()} type=${cached.termType} tab=${cached.tabIndex}`)
      activateTerminal(mainWindow, cached.hwnd, cached.tabIndex, cached.termType)
      return
    }

    console.log('[terminal:focus] cache miss, resolving pid=', pid)
    resolveTerminalTargets([pid]).then((results) => {
      const result = results.find((item) => item.pid === pid)
      if (!result || result.termType === 'none' || result.hwnd <= 0) {
        console.warn('[terminal:focus] no terminal window found for pid=', pid)
        return
      }

      activateTerminal(mainWindow, BigInt(result.hwnd), result.tabIndex, result.termType)
    })
  })
}

export function updateSessions(mainWindow: BrowserWindow, sessions: unknown): void {
  mainWindow.webContents.send('sessions:update', sessions)
}

export function getSettings(): AppSettings {
  return { ...currentSettings }
}
