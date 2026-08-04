$ErrorActionPreference = 'Stop'
$moduleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workshopRoot = [IO.Path]::GetFullPath((Join-Path $moduleRoot '..\..\..'))
$stateRoot = Join-Path $workshopRoot 'state\ai-seat-courier'
$inbox = Join-Path $stateRoot 'inbox'
$outbox = Join-Path $stateRoot 'outbox'
$lockPath = Join-Path $stateRoot 'daemon.lock.json'

if (-not (Test-Path -LiteralPath $lockPath)) {
  Write-Host 'AXM AI Seat Courier is not running.'
  exit 0
}

New-Item -ItemType Directory -Force -Path $inbox,$outbox | Out-Null
$id = 'shutdown-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$requestPath = Join-Path $inbox ($id + '.json')
$responsePath = Join-Path $outbox ($id + '.json')
$requestJson = @{ schema='axm.ai-seat-courier.request/v1'; id=$id; action='shutdown' } | ConvertTo-Json
[IO.File]::WriteAllText($requestPath, $requestJson, (New-Object Text.UTF8Encoding($false)))

for ($attempt = 0; $attempt -lt 80; $attempt += 1) {
  if (Test-Path -LiteralPath $responsePath) {
    Write-Host 'AXM AI Seat Courier stopped cleanly.'
    exit 0
  }
  Start-Sleep -Milliseconds 125
}

$lock = Get-Content -Raw -LiteralPath $lockPath | ConvertFrom-Json
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$($lock.pid)" -ErrorAction SilentlyContinue
if ($process -and $process.CommandLine -like '*ai-seat-courier*courier-daemon.js*') {
  Stop-Process -Id $lock.pid
  Write-Host 'AXM AI Seat Courier was stopped after its clean-shutdown timeout.'
  exit 0
}

throw 'Courier lock exists, but its PID does not belong to the AXM courier; refusing to stop it.'
