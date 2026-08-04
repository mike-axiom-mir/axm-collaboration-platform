[CmdletBinding()]
param(
  [string]$WorkshopRoot = '',
  [string]$ReceiptPath = ''
)

$ErrorActionPreference = 'Stop'
if (-not $WorkshopRoot) { $WorkshopRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')) }
else { $WorkshopRoot = [System.IO.Path]::GetFullPath($WorkshopRoot) }
if (-not $ReceiptPath) { $ReceiptPath = Join-Path $WorkshopRoot 'state\public-release\windows-offline-local-proof.json' }
$ReceiptPath = [System.IO.Path]::GetFullPath($ReceiptPath)
$Node = Join-Path $WorkshopRoot 'runtime\node\node.exe'
$Verifier = Join-Path $WorkshopRoot 'scripts\verify-offline-runtime.ps1'
$Collector = Join-Path $WorkshopRoot 'scripts\collect-windows-offline-evidence.ps1'
$EvidencePath = [System.IO.Path]::ChangeExtension($ReceiptPath, '.network-evidence.json')
$StartedAt = (Get-Date).ToUniversalTime()
$Cycles = @()
$Failure = $null
$RuntimeVerification = $null

function Get-FreePort {
  $Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
  $Listener.Start()
  try { return ([System.Net.IPEndPoint]$Listener.LocalEndpoint).Port }
  finally { $Listener.Stop() }
}

function Test-PortReleased([int]$Port) {
  try {
    $Probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$Port)
    $Probe.Start(); $Probe.Stop(); return $true
  } catch { return $false }
}

function Invoke-Cycle([int]$Index) {
  $Port = Get-FreePort
  $Token = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
  $Stdout = Join-Path ([System.IO.Path]::GetTempPath()) ("axm-offline-proof-$PID-$Index.stdout.txt")
  $Stderr = Join-Path ([System.IO.Path]::GetTempPath()) ("axm-offline-proof-$PID-$Index.stderr.txt")
  $Previous = @{
    Path=$env:Path; AXM_PORT=$env:AXM_PORT; AXM_NO_BROWSER=$env:AXM_NO_BROWSER;
    AXM_SAFE_MODE=$env:AXM_SAFE_MODE; AXM_SHUTDOWN_TOKEN=$env:AXM_SHUTDOWN_TOKEN
  }
  $Process = $null
  $Health = $null
  $ObservedConnections = @()
  try {
    $env:Path = "$env:SystemRoot\System32;$env:SystemRoot;$env:SystemRoot\System32\Wbem;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
    $env:AXM_PORT = [string]$Port
    $env:AXM_NO_BROWSER = '1'
    $env:AXM_SAFE_MODE = '1'
    $env:AXM_SHUTDOWN_TOKEN = $Token
    if (Get-Command node.exe -ErrorAction SilentlyContinue) { throw 'SYSTEM_NODE_REMAINS_ON_PROOF_PATH' }
    $Process = Start-Process -FilePath $Node -ArgumentList @('server.js','--open=none') -WorkingDirectory $WorkshopRoot -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr -WindowStyle Hidden -PassThru
  } finally {
    $env:Path=$Previous.Path; $env:AXM_PORT=$Previous.AXM_PORT; $env:AXM_NO_BROWSER=$Previous.AXM_NO_BROWSER
    $env:AXM_SAFE_MODE=$Previous.AXM_SAFE_MODE; $env:AXM_SHUTDOWN_TOKEN=$Previous.AXM_SHUTDOWN_TOKEN
  }
  try {
    $Deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $Deadline) {
      if ($Process.HasExited) { throw "CANDIDATE_EXITED_BEFORE_READY:$($Process.ExitCode)" }
      try {
        $Connections = @(Get-NetTCPConnection -OwningProcess $Process.Id -ErrorAction SilentlyContinue)
        foreach ($Connection in $Connections) {
          $ObservedConnections += [ordered]@{ local=$Connection.LocalAddress; local_port=$Connection.LocalPort; remote=$Connection.RemoteAddress; remote_port=$Connection.RemotePort; state=[string]$Connection.State }
        }
      } catch {}
      try { $Health = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2 }
      catch { Start-Sleep -Milliseconds 250; continue }
      if ($Health.ok -eq $true -and $Health.safeMode -eq $true) { break }
    }
    if (-not $Health -or $Health.ok -ne $true) { throw 'LOOPBACK_READINESS_TIMEOUT' }
    $Stop = Invoke-RestMethod -UseBasicParsing -Method Post -Uri "http://127.0.0.1:$Port/api/runtime/stop" -Headers @{ 'x-axm-shutdown-token'=$Token } -ContentType 'application/json' -Body '{}'
    if ($Stop.owned_process_stop_accepted -ne $true -or [int]$Stop.pid -ne $Process.Id) { throw 'OWNED_STOP_RECEIPT_MISMATCH' }
    if (-not $Process.WaitForExit(10000)) { throw 'GRACEFUL_STOP_TIMEOUT' }
    $ReleaseDeadline = (Get-Date).AddSeconds(5); $Released = $false
    do { $Released = Test-PortReleased $Port; if(-not $Released){Start-Sleep -Milliseconds 100} } while(-not $Released -and (Get-Date)-lt $ReleaseDeadline)
    if (-not $Released) { throw 'PORT_NOT_RELEASED' }
    return [ordered]@{
      cycle=$Index; decision='PASS'; pid=$Process.Id; port=$Port; readiness=[ordered]@{bind='127.0.0.1';port=$Port;safe_mode=$true}
      runtime_from_candidate_bundle=$true; owned_process_stopped=$true; graceful_stop=$true; port_released=$true
      observed_connection_snapshots=@($ObservedConnections); network_trace_request_count=$null
    }
  } finally {
    if ($Process -and -not $Process.HasExited) { Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $Stdout,$Stderr -Force -ErrorAction SilentlyContinue
  }
}

try {
  if (-not (Test-Path -LiteralPath (Join-Path $WorkshopRoot 'AXM_OFFLINE_FIRST.json') -PathType Leaf)) { throw 'OFFLINE_CANDIDATE_MARKER_MISSING' }
  $VerificationOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Verifier -WorkshopRoot $WorkshopRoot 2>&1)
  if ($LASTEXITCODE -ne 0) { throw ('RUNTIME_VERIFICATION_FAILED:' + (($VerificationOutput | Select-Object -Last 6) -join ' ')) }
  $RuntimeVerification = ($VerificationOutput | Select-Object -Last 1) | ConvertFrom-Json
  $Cycles += Invoke-Cycle 1
  $Cycles += Invoke-Cycle 2
  if (Test-Path -LiteralPath $Collector -PathType Leaf) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Collector -OutputPath $EvidencePath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'NETWORK_EVIDENCE_COLLECTION_FAILED' }
  }
} catch { $Failure = $_.Exception.Message }

$AdaptersDisabled = $false
try {
  $Physical = @(Get-NetAdapter -Physical -ErrorAction Stop)
  $AdaptersDisabled = $Physical.Count -gt 0 -and @($Physical | Where-Object Status -ne 'Disabled').Count -eq 0
} catch {}
$PassedCycles = @($Cycles | Where-Object decision -eq 'PASS').Count
$Receipt = [ordered]@{
  schema='axm.deploy.windows-offline-local-proof.v1'
  decision=if(-not $Failure -and $PassedCycles -eq 2){'PASS'}else{'HOLD'}
  started_at=$StartedAt.ToString('o'); finished_at=(Get-Date).ToUniversalTime().ToString('o')
  candidate_root=(Split-Path -Leaf $WorkshopRoot)
  runtime_verification=$RuntimeVerification
  lifecycle_receipt=[ordered]@{
    schema='axm.deploy.windows-lifecycle-receipt.v1'; decision=if($PassedCycles -eq 2){'PASS'}else{'HOLD'}
    readiness=if($PassedCycles){$Cycles[0].readiness}else{$null}; restart_passed=$PassedCycles -eq 2
    runtime_from_candidate_bundle=$PassedCycles -eq 2; owned_process_stopped=$PassedCycles -eq 2
    graceful_stop=$PassedCycles -eq 2; port_released=$PassedCycles -eq 2
    started_with_network_adapters_disabled=$AdaptersDisabled; network_trace_request_count=$null
  }
  cycles=@($Cycles); network_evidence_path=if(Test-Path -LiteralPath $EvidencePath){$EvidencePath}else{$null}
  network_request_count_measured=$false
  windows_offline_first_proven=$false
  physical_proof=$false
  public_support=$false
  publication_authority=$false
  held_reason='Lifecycle and bundled runtime can pass locally, but a sampled connection view is not a complete request trace.'
  failure=$Failure
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ReceiptPath) | Out-Null
$Receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8
if ($Receipt.decision -ne 'PASS') { throw "Offline local proof held: $Failure (receipt: $ReceiptPath)" }
Write-Output "AXM offline local proof: PASS (receipt: $ReceiptPath)"

