# List all Windows Terminal tabs in a stable order and output as JSON
Add-Type -AssemblyName UIAutomationClient

$root = [System.Windows.Automation.AutomationElement]::RootElement
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
            InternalID = 10000 + $globalIndex
            PID = $wt.PID
            TabName = $tab.Current.Name
        }
        $globalIndex++
    }
}

# Output as JSON array (use -InputObject to ensure array format for empty/single-element arrays)
ConvertTo-Json -InputObject $allTabs -Depth 3
