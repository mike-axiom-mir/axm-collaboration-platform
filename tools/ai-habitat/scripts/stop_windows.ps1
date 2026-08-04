$ErrorActionPreference = 'Stop'

$moduleRoot = Split-Path -Parent $PSScriptRoot
$expectedEntry = (Join-Path $moduleRoot 'workshop_runtime.py').ToLowerInvariant()
$listeners = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue)

if (-not $listeners.Count) {
    Write-Host 'AXM AI Habitat is already stopped.' -ForegroundColor DarkCyan
    exit 0
}

$ownerProcessIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($ownerProcessId in $ownerProcessIds) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerProcessId"
    $commandLine = [string]$processInfo.CommandLine
    if (-not $commandLine.ToLowerInvariant().Contains($expectedEntry)) {
        throw "Port 8765 belongs to a different process. Refusing to stop process $ownerProcessId."
    }
    Stop-Process -Id $ownerProcessId
    Write-Host "Stopped AXM AI Habitat process $ownerProcessId." -ForegroundColor Green
}
