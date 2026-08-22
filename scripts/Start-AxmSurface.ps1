param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Hub', 'Games', 'Bridge', 'CommandMirror')]
  [string]$Mode
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Find-Node {
  $bundled = Join-Path $root 'runtime\node\node.exe'
  if (Test-Path -LiteralPath $bundled) { return $bundled }
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw 'Node.js was not found. Run OPEN_AXM_WORKSHOP.cmd once for the beginner setup message.'
}

function Test-LocalPort([int]$Port) {
  try {
    $client = [Net.Sockets.TcpClient]::new()
    $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $pending.AsyncWaitHandle.WaitOne(350)) { $client.Dispose(); return $false }
    $client.EndConnect($pending)
    $client.Dispose()
    return $true
  } catch { return $false }
}

function Test-ExpectedService {
  param(
    [int]$Port,
    [string]$HealthPath,
    [string]$HealthProperty,
    [string]$HealthValue
  )

  if (-not $HealthPath) { return Test-LocalPort $Port }
  try {
    $health = Invoke-RestMethod -UseBasicParsing -Uri ("http://127.0.0.1:{0}{1}" -f $Port, $HealthPath) -TimeoutSec 2
    return $health.ok -eq $true -and [string]$health.$HealthProperty -eq $HealthValue
  } catch { return $false }
}

function Start-NodeService {
  param(
    [string]$Title,
    [string]$Entry,
    [int]$Port,
    [hashtable]$Environment = @{},
    [string]$HealthPath,
    [string]$HealthProperty,
    [string]$HealthValue
  )

  if (Test-LocalPort $Port) {
    if (Test-ExpectedService -Port $Port -HealthPath $HealthPath -HealthProperty $HealthProperty -HealthValue $HealthValue) { return }
    throw "$Title cannot start because port $Port belongs to a different or stale service. Close that service, then click the AXM pictogram again."
  }
  $node = Find-Node
  $sets = foreach ($key in $Environment.Keys) { 'set "{0}={1}"' -f $key, $Environment[$key] }
  $parts = @(
    ('title {0}' -f $Title),
    ('cd /d "{0}"' -f $root)
  ) + $sets + @(
    ('"{0}" "{1}"' -f $node, (Join-Path $root $Entry))
  )
  Start-Process -FilePath $env:ComSpec -ArgumentList '/k', ($parts -join ' && ') -WindowStyle Minimized | Out-Null

  $deadline = [DateTime]::UtcNow.AddSeconds(12)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-ExpectedService -Port $Port -HealthPath $HealthPath -HealthProperty $HealthProperty -HealthValue $HealthValue) { return }
    if (Test-LocalPort $Port) {
      throw "$Title opened port $Port without its expected health identity. Close its minimized window, then click the AXM pictogram again."
    }
    Start-Sleep -Milliseconds 250
  }
  throw "$Title did not become ready on local port $Port. Its minimized window contains the error."
}

function Ensure-Workshop {
  Start-NodeService -Title 'AXM Workshop' -Entry 'server.js' -Port 8790 -HealthPath '/api/health' -HealthProperty 'body' -HealthValue 'axm-workshop' -Environment @{
    AXM_PORT = '8790'
    AXM_NO_BROWSER = '1'
  }
}

switch ($Mode) {
  'Hub' {
    Ensure-Workshop
    Start-Process 'http://127.0.0.1:8790/hub/index.html'
  }
  'Games' {
    Ensure-Workshop
    Start-NodeService -Title 'AXM Games' -Entry 'tools\game-hub\game-hub-server.js' -Port 8789 -HealthPath '/health' -HealthProperty 'name' -HealthValue 'AXM Game Hub' -Environment @{
      AXM_GAME_HUB_PORT = '8789'
      AXM_GAME_IDLE_TIMEOUT_MS = '1800000'
      AXM_WORKSHOP_PORT = '8790'
    }
    Start-Process 'http://127.0.0.1:8790/tools/game-hub/index.html'
  }
  'Bridge' {
    Ensure-Workshop
    Start-NodeService -Title 'AXM Bridge' -Entry 'bridge\axm-bridge.js' -Port 8787
    Start-Process 'http://127.0.0.1:8790/hub/index.html'
  }
  'CommandMirror' {
    Ensure-Workshop
    Start-NodeService -Title 'AXM Mirror Core' -Entry 'shared\mirror-core\server\server.js' -Port 8799 -Environment @{
      AXM_MIRROR_PORT = '8799'
    }
    Start-Process 'http://127.0.0.1:8790/tools/workshop-command-center/index.html'
  }
}
