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
const SendInput = user32.func('uint32 __stdcall SendInput(uint32 cInputs, _In_ void * pInputs, int32 cbSize)')

const SW_RESTORE = 9
const KEYEVENTF_KEYUP = 0x0002
const VK_CONTROL = 0x11
const VK_SHIFT = 0x10
const VK_MENU = 0x12
const VK_1 = 0x31
const VK_0 = 0x30
const CACHE_TTL = 5 * 60 * 1000

// INPUT struct size on x64 Windows (type 4 + padding 4 + union 32 = 40)
const INPUT_SIZE_X64 = 40
const INPUT_KEYBOARD = 1
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
  wtPid: number
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

function sendWindowsTerminalTabShortcut(tabIndex: number): boolean {
  if (tabIndex < 0 || tabIndex > 9) {
    console.warn(`[terminal:focus] tabIndex out of range: ${tabIndex}`)
    return false
  }

  const digitKey = tabIndex === 9 ? VK_0 : VK_1 + tabIndex
  const digitChar = tabIndex === 9 ? '0' : String(tabIndex + 1)

  // Log before sending
  const beforeFg = GetForegroundWindow() as unknown
  const beforeFgHwnd = beforeFg ? BigInt(Number(beforeFg as unknown)).toString() : 'null'
  console.log(
    `[terminal:focus] about to send keys via SendInput: Ctrl+Alt+${digitChar} (vk=0x${digitKey.toString(16)}) currentFg=${beforeFgHwnd}`
  )

  // Build 6 INPUT structures in one atomic call: Ctrl↓ Alt↓ Digit↓ Digit↑ Alt↑ Ctrl↑
  // x64 INPUT layout: type(4) + padding(4) + ki.wVk(2) + ki.wScan(2) + ki.dwFlags(4) + ki.time(4) + padding(4) + ki.dwExtraInfo(8) = 40 bytes
  const inputs = Buffer.alloc(INPUT_SIZE_X64 * 6)

  const writeInput = (index: number, vk: number, flags: number): void => {
    const off = index * INPUT_SIZE_X64
    inputs.writeUInt32LE(INPUT_KEYBOARD, off) // type
    inputs.writeUInt16LE(vk, off + 8) // ki.wVk
    inputs.writeUInt16LE(0, off + 10) // ki.wScan
    inputs.writeUInt32LE(flags, off + 12) // ki.dwFlags
    inputs.writeUInt32LE(0, off + 16) // ki.time
    inputs.writeBigUInt64LE(0n, off + 24) // ki.dwExtraInfo (at offset 24 within INPUT)
  }

  writeInput(0, VK_CONTROL, 0)
  writeInput(1, VK_MENU, 0)
  writeInput(2, digitKey, 0)
  writeInput(3, digitKey, KEYEVENTF_KEYUP)
  writeInput(4, VK_MENU, KEYEVENTF_KEYUP)
  writeInput(5, VK_CONTROL, KEYEVENTF_KEYUP)

  const sentCount = SendInput(6, inputs, INPUT_SIZE_X64) as unknown as number

  const afterFg = GetForegroundWindow() as unknown
  const afterFgHwnd = afterFg ? BigInt(Number(afterFg as unknown)).toString() : 'null'
  console.log(`[terminal:focus] SendInput sent ${sentCount}/6 events, fg after=${afterFgHwnd}`)

  return sentCount === 6
}

function focusWindowsTerminalTab(targetHwnd: bigint, tabIndex: number): void {
  if (tabIndex < 0) {
    console.warn(`[terminal:focus] skip tab switch: tabIndex=${tabIndex}`)
    return
  }

  // Before sending shortcut, attach to target window's thread for input
  const currentThreadId = GetCurrentThreadId() as unknown as number
  const targetThreadId = Number(GetWindowThreadProcessId(targetHwnd as unknown, null))
  const needAttach = targetThreadId > 0 && targetThreadId !== currentThreadId

  if (needAttach) {
    const attachResult = AttachThreadInput(currentThreadId, targetThreadId, true)
    console.log(`[terminal:focus] AttachThreadInput(${currentThreadId}→${targetThreadId})=${attachResult}`)
  }

  const sentShortcut = sendWindowsTerminalTabShortcut(tabIndex)

  // Delay before detach to give WT time to process the keyboard events
  setTimeout(() => {
    if (needAttach) {
      AttachThreadInput(currentThreadId, targetThreadId, false)
    }

    if (sentShortcut) {
      console.log(`[terminal:focus] completed Ctrl+Alt+${tabIndex === 9 ? 0 : tabIndex + 1}`)
    }

    // Always run wt command as reliable fallback / double-check
    // WT will operate on the currently focused window
    console.log(`[terminal:focus] running wt focus-tab --tab ${tabIndex}`)
    execFile('wt', ['focus-tab', '--tab', String(tabIndex)], { windowsHide: true }, (err) => {
      if (err) {
        console.warn('[terminal:focus] wt focus-tab failed:', err.message)
      } else {
        console.log('[terminal:focus] wt focus-tab command executed')
      }
    })
  }, 200)
}

function activateTerminal(
  mainWindow: BrowserWindow,
  hwnd: bigint,
  tabIndex: number,
  termType: string
): void {
  console.log(`[terminal:focus] activateTerminal called: hwnd=${hwnd.toString()} tab=${tabIndex} type=${termType}`)

  if (!IsWindow(hwnd as unknown)) {
    console.warn('[terminal:focus] cached hwnd is no longer valid:', hwnd.toString())
    return
  }

  const bringToFront = (): void => {
    const wasIconic = IsIconic(hwnd as unknown)
    console.log(`[terminal:focus] bringToFront start: wasIconic=${wasIconic}`)

    if (wasIconic) {
      ShowWindow(hwnd as unknown, SW_RESTORE)
    }

    const currentThreadId = GetCurrentThreadId() as unknown as number
    const foregroundHwnd = GetForegroundWindow() as unknown
    const foregroundHwndNum = foregroundHwnd ? Number(foregroundHwnd as unknown) : 0
    const foregroundThreadId = foregroundHwnd
      ? Number(GetWindowThreadProcessId(foregroundHwnd, null))
      : currentThreadId

    console.log(`[terminal:focus] before SetForegroundWindow: currentThread=${currentThreadId} fgHwnd=${foregroundHwndNum} fgThread=${foregroundThreadId}`)

    if (foregroundThreadId !== currentThreadId) {
      const attachBefore = AttachThreadInput(currentThreadId, foregroundThreadId, true)
      console.log(`[terminal:focus] AttachThreadInput before=${attachBefore}`)
    }

    const foregroundResult = SetForegroundWindow(hwnd as unknown)
    const bringResult = BringWindowToTop(hwnd as unknown)

    if (foregroundThreadId !== currentThreadId) {
      const attachAfter = AttachThreadInput(currentThreadId, foregroundThreadId, false)
      console.log(`[terminal:focus] AttachThreadInput after=${attachAfter}`)
    }

    console.log(`[terminal:focus] SetForegroundWindow=${foregroundResult} BringWindowToTop=${bringResult}`)

    if (termType === 'wt' && tabIndex >= 0) {
      // Longer delay: WT needs time to fully activate, especially after restore
      setTimeout(() => {
        // Double-check foreground window is still WT before sending shortcut
        const fgNow = GetForegroundWindow() as unknown
        const fgHwnd = fgNow ? BigInt(Number(fgNow as unknown)) : BigInt(0)
        const fgPidArr = new Uint32Array(1)
        if (fgNow) {
          GetWindowThreadProcessId(fgNow as unknown, fgPidArr)
        }
        console.log(`[terminal:focus] before shortcut: expected=${hwnd.toString()} actual=${fgHwnd.toString()} actualPid=${fgPidArr[0]}`)

        if (fgHwnd !== hwnd) {
          console.warn(`[terminal:focus] foreground mismatch! expected=${hwnd.toString()} actual=${fgHwnd.toString()}`)
        }

        focusWindowsTerminalTab(hwnd, tabIndex)
      }, 600)
    }
  }

  if (IsIconic(hwnd as unknown)) {
    ShowWindow(hwnd as unknown, SW_RESTORE)
    setTimeout(bringToFront, 150)
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
param([string]$TargetPidList, [string]$ResultPath)
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
  $name = [System.IO.Path]::GetFileNameWithoutExtension([string]$_.Name)
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

# Pre-fetch OpenConsole list once at script level to avoid PowerShell pipeline quirks
$script:allOpenConsoles = @(Get-Process -Name OpenConsole -ErrorAction SilentlyContinue | Where-Object { $_.StartTime } | Sort-Object StartTime)
if ($script:allOpenConsoles.Count -eq 0) {
  $script:allOpenConsoles = @(Get-Process -Name conhost -ErrorAction SilentlyContinue | Where-Object { $_.StartTime } | Sort-Object StartTime)
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

function Test-IsWindowsTerminalProcess($Proc) {
  $procName = if ($Proc.Name) { $Proc.Name } else { $Proc.ProcessName }
  return $Proc -and ($procName -eq "WindowsTerminal" -or $procName -eq "WindowsTerminalPreview")
}

function Get-WindowsTerminalRoot($Ancestors, $ConsoleRoot) {
  $wtAncestor = $Ancestors | Where-Object { Test-IsWindowsTerminalProcess $_ } | Select-Object -First 1
  if ($wtAncestor) { return $wtAncestor }

  if ($ConsoleRoot -and $processMap.ContainsKey($ConsoleRoot.Parent)) {
    $parentProc = $processMap[$ConsoleRoot.Parent]
    if (Test-IsWindowsTerminalProcess $parentProc) { return $parentProc }
  }

  foreach ($candidate in $processMap.Values) {
    if ((Test-IsWindowsTerminalProcess $candidate) -and $ConsoleRoot -and (Test-TreeContains $candidate.Pid $ConsoleRoot.Pid)) {
      return $candidate
    }
  }

  # Fallback: match WT by start time proximity to OpenConsole
  if ($ConsoleRoot -and $getProcessMap.ContainsKey($ConsoleRoot.Pid)) {
    $consoleStart = $getProcessMap[$ConsoleRoot.Pid].StartTime
    $wtCandidates = @($getProcessMap.Values | Where-Object { Test-IsWindowsTerminalProcess $_ -and $_.StartTime })
    $best = $null
    $bestDiff = [double]::MaxValue
    foreach ($wt in $wtCandidates) {
      $diff = [Math]::Abs(($wt.StartTime - $consoleStart).TotalSeconds)
      if ($diff -lt $bestDiff) {
        $best = $wt
        $bestDiff = $diff
      }
    }
    if ($best -and $bestDiff -le 300) {
      return $processMap[[int]$best.Id]
    }
  }

  # Last resort: if there's exactly one WT process on the system, use it
  $allWt = @($getProcessMap.Values | Where-Object { Test-IsWindowsTerminalProcess $_ })
  if ($allWt.Count -eq 1) {
    return $processMap[[int]$allWt[0].Id]
  }

  return $null
}

function Get-ShellAncestor($Ancestors) {
  return $Ancestors | Where-Object { $_.Name -eq "cmd" -or $_.Name -eq "powershell" -or $_.Name -eq "pwsh" } | Select-Object -First 1
}

function Get-MatchingConsoleRoot($ShellProc) {
  if (-not $ShellProc -or -not $getProcessMap.ContainsKey($ShellProc.Pid)) { return $null }

  $shellStart = $getProcessMap[$ShellProc.Pid].StartTime
  $rootCandidates = @($getProcessMap.Values | Where-Object { $_.ProcessName -eq "OpenConsole" -and $_.StartTime })
  if ($rootCandidates.Count -eq 0) {
    $rootCandidates = @($getProcessMap.Values | Where-Object { $_.ProcessName -eq "conhost" -and $_.StartTime })
  }

  $best = $null
  $bestDiff = [double]::MaxValue

  foreach ($candidate in $rootCandidates) {
    $diff = [Math]::Abs(($candidate.StartTime - $shellStart).TotalSeconds)
    if ($diff -lt $bestDiff) {
      $best = $candidate
      $bestDiff = $diff
    }
  }

  if ($best -and $bestDiff -le 3) {
    return $processMap[[int]$best.Id]
  }

  return $null
}

function Get-AllConsoleRoots() {
  $roots = @($getProcessMap.Values |
    Where-Object { $_.ProcessName -eq "OpenConsole" -and $_.StartTime } |
    Sort-Object StartTime)

  if ($roots.Count -gt 0) { return $roots }

  return @($getProcessMap.Values |
    Where-Object { $_.ProcessName -eq "conhost" -and $_.StartTime } |
    Sort-Object StartTime)
}

# ---------- Phase 1: collect info for all target PIDs ----------
$targetInfos = @()
foreach ($targetPid in $targetPids) {
  try {
    $ancestors = @(Get-Ancestors $targetPid)
    $shellAncestor = Get-ShellAncestor $ancestors
    $consoleRoot = $ancestors | Where-Object { $_.Name -eq "OpenConsole" -or $_.Name -eq "conhost" } | Select-Object -First 1
    $consoleSource = "ancestors"
    if (-not $consoleRoot) {
      $consoleRoot = Get-MatchingConsoleRoot $shellAncestor
      $consoleSource = "matching"
    }
    $wtRoot = Get-WindowsTerminalRoot $ancestors $consoleRoot

    $targetInfos += [pscustomobject]@{
      TargetPid = $targetPid
      Ancestors = $ancestors
      ShellAncestor = $shellAncestor
      ConsoleRoot = $consoleRoot
      ConsoleSource = $consoleSource
      WtRoot = $wtRoot
    }
  } catch {
    [Console]::Error.WriteLine("ERROR phase1 pid=$targetPid : $($_.Exception.Message)")
    $targetInfos += [pscustomobject]@{
      TargetPid = $targetPid
      Ancestors = @()
      ShellAncestor = $null
      ConsoleRoot = $null
      ConsoleSource = "error"
      WtRoot = $null
    }
  }
}

# ---------- Phase 2: build per-WT-window tabIndex maps ----------
# Only consider OpenConsoles that belong to target PIDs in the same WT window.
# This avoids mixing in OpenConsoles from other WT windows or other terminal apps.
$wtTabIndexMap = @{}
foreach ($info in $targetInfos) {
  if (-not $info.WtRoot -or -not $info.ConsoleRoot) { continue }
  $wtPid = [int]$info.WtRoot.Pid
  if (-not $wtTabIndexMap.ContainsKey($wtPid)) {
    $wtTabIndexMap[$wtPid] = @{}
  }
}

$wtPidList = @($wtTabIndexMap.Keys)
foreach ($wtPid in $wtPidList) {
  $ocPidList = [System.Collections.Generic.List[int]]::new()
  foreach ($info in $targetInfos) {
    if ($info.WtRoot -and [int]$info.WtRoot.Pid -eq $wtPid -and $info.ConsoleRoot) {
      $ocPidList.Add([int]$info.ConsoleRoot.Pid)
    }
  }

  $uniqueOcPids = @($ocPidList | Sort-Object -Unique)
  $ocProcs = @()
  foreach ($ocPid in $uniqueOcPids) {
    if ($getProcessMap.ContainsKey($ocPid)) {
      $ocProcs += $getProcessMap[$ocPid]
    }
  }
  $ocProcs = @($ocProcs | Where-Object { $_.StartTime } | Sort-Object StartTime)

  $tabMap = @{}
  for ($i = 0; $i -lt $ocProcs.Count; $i++) {
    $tabMap[[int]$ocProcs[$i].Id] = $i
  }
  $wtTabIndexMap[$wtPid] = $tabMap

  $ocIdList = ($ocProcs | ForEach-Object { $_.Id }) -join ','
  [Console]::Error.WriteLine("WT=$wtPid windowConsoles=$($ocProcs.Count) ids=$ocIdList")
}

# ---------- Phase 3: generate final results ----------
foreach ($info in $targetInfos) {
  $targetPid = $info.TargetPid
  $hwnd = 0
  $tabIndex = -1
  $termType = "none"
  $wtPidValue = 0

  if ($info.WtRoot) {
    $termType = "wt"
    $wtPidValue = [int]$info.WtRoot.Pid

    # Get WT window handle: prefer MainWindowHandle, fallback to EnumWindows
    foreach ($proc in $getProcessMap.Values) {
      if ((Test-IsWindowsTerminalProcess $proc) -and $proc.MainWindowHandle -and $proc.MainWindowHandle -ne [IntPtr]::Zero) {
        $hwnd = $proc.MainWindowHandle.ToInt64()
        break
      }
    }
    if ($hwnd -eq 0) {
      foreach ($proc in $getProcessMap.Values) {
        if (Test-IsWindowsTerminalProcess $proc) {
          $fallbackHwnd = [VibeWin32]::FindVisibleHwndByPid($proc.Id)
          if ($fallbackHwnd -ne [IntPtr]::Zero) {
            $hwnd = $fallbackHwnd.ToInt64()
            break
          }
        }
      }
    }

    # Look up relative tabIndex from the per-window map
    if ($wtTabIndexMap.ContainsKey($wtPidValue) -and $info.ConsoleRoot) {
      $tabMap = $wtTabIndexMap[$wtPidValue]
      $ocPid = [int]$info.ConsoleRoot.Pid
      if ($tabMap.ContainsKey($ocPid)) {
        $tabIndex = $tabMap[$ocPid]
      }
    }

    [Console]::Error.WriteLine("pid=$targetPid tab=$tabIndex target=$($info.ConsoleRoot.Pid) source=$($info.ConsoleSource)")
  } elseif ($info.ConsoleRoot -and $info.ShellAncestor) {
    $consoleHwnd = [VibeWin32]::GetConsoleHwnd($info.ShellAncestor.Pid)
    if ($consoleHwnd -ne [IntPtr]::Zero) {
      $hwnd = $consoleHwnd.ToInt64()
      $termType = "cmd"
    }
  } else {
    $visible = [VibeWin32]::FindVisibleHwndByPid($targetPid)
    if ($visible -ne [IntPtr]::Zero) {
      $hwnd = $visible.ToInt64()
      $termType = "cmd"
    } else {
      $consolePid = 0
      foreach ($ancestor in $info.Ancestors) {
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
    wtPid = [int]$wtPidValue
  }
}

$jsonOutput = ConvertTo-Json -InputObject @($results) -Compress
if ($ResultPath) {
  [System.IO.File]::WriteAllText($ResultPath, $jsonOutput, [System.Text.Encoding]::UTF8)
} else {
  Write-Output $jsonOutput
}
exit 0
`

  const scriptPath = path.join(os.tmpdir(), 'vibe-notch-focus-resolver.ps1')
  const resultPath = path.join(os.tmpdir(), `vibe-notch-focus-${Date.now()}.json`)
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
        pidsToResolve.join(','),
        resultPath
      ],
      { windowsHide: true, timeout: 8000 },
      (err, _stdout, stderr) => {
        for (const pid of pidsToResolve) resolvingPids.delete(pid)

        if (stderr && stderr.trim()) {
          console.warn('[terminal:focus] resolver stderr:', stderr.trim())
        }

        let jsonText = ''
        try {
          if (fs.existsSync(resultPath)) {
            jsonText = fs.readFileSync(resultPath, 'utf8').trim()
            fs.unlinkSync(resultPath)
          }
        } catch (fsErr) {
          console.warn('[terminal:focus] failed to read result file:', (fsErr as Error).message)
        }

        if (!jsonText) {
          if (err) {
            console.warn('[terminal:focus] resolver failed and no result file:', err.message)
          } else {
            console.warn('[terminal:focus] resolver produced no result file')
          }
          resolve([])
          return
        }

        try {
          const parsed = JSON.parse(jsonText) as ResolvedTerminalTarget[] | ResolvedTerminalTarget
          let results = Array.isArray(parsed) ? parsed : [parsed]

          for (const result of results) {
            console.log(`[terminal:focus] resolved pid=${result.pid} hwnd=${result.hwnd} type=${result.termType} tab=${result.tabIndex} wtPid=${result.wtPid}`)
            setCachedFocus(result)
          }
          resolve(results)
        } catch (parseErr) {
          console.warn('[terminal:focus] resolver returned invalid JSON:', jsonText, parseErr)
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
