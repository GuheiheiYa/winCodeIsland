# ========================================
# FocusWTClaudeTabsFinal.ps1
# List all Windows Terminal tabs in a stable order and focus by:
#   1. Index
#   2. NameKeyword
#   3. InternalID (stable pseudo PID)
# ========================================

param(
    [int]$TabNumber,          # Optional: focus by global Index
    [int]$InternalID,         # Optional: focus by generated internal ID
    [string]$TabNameKeyword   # Optional: focus by tab name keyword
)

Add-Type -AssemblyName UIAutomationClient

# Win32 API for window manipulation
if (-not ("Win32" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
}

$SW_RESTORE = 9
$root = [System.Windows.Automation.AutomationElement]::RootElement

# Find all top-level windows
$allWindows = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition
)

# Filter Windows Terminal windows
$wtWindows = @()
foreach ($w in $allWindows) {
    try {
        $proc = Get-Process -Id $w.Current.ProcessId -ErrorAction Stop
        if ($proc.ProcessName -eq "WindowsTerminal") {
            $wtWindows += @{Win=$w;PID=$proc.Id;Title=$w.Current.Name}
        }
    } catch { }
}

if ($wtWindows.Count -eq 0) {
    Write-Host "No Windows Terminal windows found."
    exit
}

# Sort WT windows by PID for stable order
$wtWindows = $wtWindows | Sort-Object PID

# Build tab list with stable global Index and InternalID
$allTabs = @()
$globalIndex = 1
foreach ($wt in $wtWindows) {
    $tabItems = $wt.Win.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::TabItem
        )
    )

    foreach ($tab in $tabItems) {
        $allTabs += @{
            Index = $globalIndex
            InternalID = 10000 + $globalIndex   # Stable internal ID
            Window = $wt
            Tab = $tab
            TabName = $tab.Current.Name
        }
        $globalIndex++
    }
}

# Display all tabs
Write-Host "List of all Windows Terminal tabs (stable order):"
foreach ($t in $allTabs) {
    Write-Host ("[Index: " + $t.Index + "] [InternalID: " + $t.InternalID + "] Window PID: " + $t.Window.PID + "`tTab Name: " + $t.TabName)
}

# Function to focus a tab
function Focus-Tab($tabEntry) {
    $pattern = $tabEntry.Tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    $pattern.Select()
    [Win32]::ShowWindow([IntPtr]$tabEntry.Window.Win.Current.NativeWindowHandle, $SW_RESTORE) | Out-Null
    [Win32]::SetForegroundWindow([IntPtr]$tabEntry.Window.Win.Current.NativeWindowHandle) | Out-Null
    Write-Host ("Focused Tab [Index: " + $tabEntry.Index + "] InternalID: " + $tabEntry.InternalID + " Name: " + $tabEntry.TabName)
}

# Focus by Index
if ($TabNumber) {
    $match = $allTabs | Where-Object { $_.Index -eq $TabNumber }
    if ($match) { Focus-Tab $match }
    else { Write-Host "No tab found for Index $TabNumber." }
}

# Focus by InternalID
if ($InternalID) {
    $match = $allTabs | Where-Object { $_.InternalID -eq $InternalID }
    if ($match) { Focus-Tab $match }
    else { Write-Host "No tab found for InternalID $InternalID." }
}

# Focus by NameKeyword
if ($TabNameKeyword) {
    $match = $allTabs | Where-Object { $_.TabName -like "*$TabNameKeyword*" } | Select-Object -First 1
    if ($match) { Focus-Tab $match }
    else { Write-Host "No tab found matching keyword '$TabNameKeyword'." }
}