$ErrorActionPreference = 'Stop'
$moduleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workshopRoot = [IO.Path]::GetFullPath((Join-Path $moduleRoot '..\..\..'))
$stateRoot = Join-Path $workshopRoot 'state\ai-seat-courier'
$statusPath = Join-Path $stateRoot 'status.json'
$lockPath = Join-Path $stateRoot 'daemon.lock.json'

New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null

if (Test-Path -LiteralPath $lockPath) {
  try {
    $lock = Get-Content -Raw -LiteralPath $lockPath | ConvertFrom-Json
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($lock.pid)" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -like '*ai-seat-courier*courier-daemon.js*') {
      Write-Host "AXM AI Seat Courier is already running (PID $($lock.pid))."
      Write-Host "Sonnet guide: $moduleRoot\SONNET_START_HERE.md"
      exit 0
    }
  } catch { }
}

$process = Start-Process -FilePath 'node.exe' `
  -ArgumentList 'courier-daemon.js' `
  -WorkingDirectory $moduleRoot `
  -WindowStyle Hidden `
  -PassThru

for ($attempt = 0; $attempt -lt 80; $attempt += 1) {
  if ($process.HasExited) { throw 'AI Seat Courier stopped before becoming ready.' }
  if (Test-Path -LiteralPath $statusPath) {
    try {
      $status = Get-Content -Raw -LiteralPath $statusPath | ConvertFrom-Json
      if ($status.status -eq 'ready' -and $status.pid -eq $process.Id) {
        Write-Host "AXM AI Seat Courier is ready (PID $($process.Id))."
        Write-Host "Sonnet guide: $moduleRoot\SONNET_START_HERE.md"
        Write-Host "Mailbox: $stateRoot"
        exit 0
      }
    } catch { }
  }
  Start-Sleep -Milliseconds 125
}

throw 'AI Seat Courier did not become ready in time.'
