[CmdletBinding()]
param(
  [string]$ReceiptPath = ''
)

$ErrorActionPreference = 'Stop'
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$RunRoot = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetTempPath()) ('axm-public-launch-' + [Guid]::NewGuid().ToString('N'))))
$Candidate = Join-Path $RunRoot 'AXM Public Candidate With Spaces'
$Stdout = Join-Path $RunRoot 'launcher.stdout.txt'
$Stderr = Join-Path $RunRoot 'launcher.stderr.txt'
$Process = $null
$StartedAt = (Get-Date).ToUniversalTime()
$Verdict = 'FAIL'
$Failure = $null
$Health = $null

if (-not $ReceiptPath) {
  $ReceiptPath = Join-Path $Root 'state\public-release\latest-windows-clean-launch.json'
}
$ReceiptPath = [System.IO.Path]::GetFullPath($ReceiptPath)

function Get-FreePort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  try { return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port }
  finally { $listener.Stop() }
}

function Get-Tail([string]$Path, [int]$Lines = 30) {
  if (-not (Test-Path -LiteralPath $Path)) { return @() }
  return @(Get-Content -LiteralPath $Path -Tail $Lines -ErrorAction SilentlyContinue | ForEach-Object { [string]$_ })
}

function Stop-ProcessTree([int]$ProcessId) {
  $Children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
  foreach ($Child in $Children) { Stop-ProcessTree ([int]$Child.ProcessId) }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $RunRoot | Out-Null
try {
  $StagingNode = (Get-Command node.exe -ErrorAction Stop).Source
  & $StagingNode (Join-Path $Root 'scripts\stage-public-candidate.js') --root $Root --destination $Candidate
  if ($LASTEXITCODE -ne 0) { throw "Public-policy candidate staging failed with code $LASTEXITCODE" }

  if (Test-Path -LiteralPath (Join-Path $Candidate 'runtime')) {
    throw 'Clean candidate unexpectedly contains a runtime before first launch.'
  }

  $Port = Get-FreePort
  $Previous = @{
    Path = $env:Path
    AXM_PORT = $env:AXM_PORT
    AXM_NO_BROWSER = $env:AXM_NO_BROWSER
    AXM_NONINTERACTIVE = $env:AXM_NONINTERACTIVE
  }
  try {
    $env:Path = "$env:SystemRoot\System32;$env:SystemRoot;$env:SystemRoot\System32\Wbem;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
    $env:AXM_PORT = [string]$Port
    $env:AXM_NO_BROWSER = '1'
    $env:AXM_NONINTERACTIVE = '1'
    if (Get-Command node.exe -ErrorAction SilentlyContinue) {
      throw 'Clean-launch PATH still exposes a system Node.js runtime.'
    }
    $Process = Start-Process -FilePath "$env:SystemRoot\System32\cmd.exe" -ArgumentList @('/d','/c','call OPEN_AXM_WORKSHOP.cmd') -WorkingDirectory $Candidate -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr -WindowStyle Hidden -PassThru
  } finally {
    $env:Path = $Previous.Path
    $env:AXM_PORT = $Previous.AXM_PORT
    $env:AXM_NO_BROWSER = $Previous.AXM_NO_BROWSER
    $env:AXM_NONINTERACTIVE = $Previous.AXM_NONINTERACTIVE
  }

  $Deadline = (Get-Date).AddMinutes(3)
  do {
    try {
      $Health = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
      if ($Health.ok -eq $true) { break }
    } catch {}
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $Deadline)

  if (-not $Health -or $Health.ok -ne $true) { throw 'Hub health route did not become ready within three minutes.' }
  $Hub = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/hub/index.html" -TimeoutSec 10
  if ($Hub.StatusCode -ne 200 -or $Hub.Content -notmatch 'AXM') { throw 'Hub page did not return an AXM document.' }

  $RuntimeNode = Join-Path $Candidate 'runtime\node\node.exe'
  if (-not (Test-Path -LiteralPath $RuntimeNode -PathType Leaf)) { throw 'Launcher reached health without the expected bootstrapped private runtime.' }
  $RuntimeVersion = (& $RuntimeNode --version | Select-Object -First 1)
  if ($RuntimeVersion -ne 'v24.17.0') { throw "Bootstrapped runtime reported $RuntimeVersion instead of v24.17.0." }
  $Provenance = Get-Content -Raw -LiteralPath (Join-Path $Candidate 'runtime\node\RUNTIME_PROVENANCE.json') | ConvertFrom-Json
  if ($Provenance.archive_sha256 -ne 'f2aa33b35b75aca5f3f7b85675a6f6423201053e9381911e64961f3bda2528ab' -and $Provenance.archive_sha256 -ne '4957712f67fce55779cc794d9b4df9e0e802a18c841ad5a4e42f17be490e634d') {
    throw 'Runtime provenance does not contain an approved pinned archive digest.'
  }
  $Verdict = 'PASS'
} catch {
  $Failure = $_.Exception.Message
} finally {
  if ($Process -and -not $Process.HasExited) {
    Stop-ProcessTree $Process.Id
  }
  $CandidateProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessId -ne $PID -and $_.CommandLine -and
    $_.CommandLine.IndexOf($Candidate, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  foreach ($CandidateProcess in $CandidateProcesses) {
    Stop-ProcessTree ([int]$CandidateProcess.ProcessId)
  }
  $Receipt = [ordered]@{
    schema = 'axm.windows-clean-launch-smoke/v1'
    verdict = $Verdict
    started_at = $StartedAt.ToString('o')
    finished_at = (Get-Date).ToUniversalTime().ToString('o')
    candidate_shape = 'fresh public-policy staging in a path containing spaces; no system Node.js on PATH; no bundled runtime before launch'
    runtime_bootstrap = 'pinned Node.js 24.17.0 archive from nodejs.org with SHA-256 verification'
    health_ok = [bool]($Health -and $Health.ok -eq $true)
    failure = $Failure
    stdout_tail = @(Get-Tail $Stdout)
    stderr_tail = @(Get-Tail $Stderr)
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ReceiptPath) | Out-Null
  $Receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8
  if (Test-Path -LiteralPath $RunRoot) {
    $TempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $RunRoot.StartsWith($TempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Safety refusal: launch test folder escaped the temp root: $RunRoot"
    }
    Get-ChildItem -LiteralPath $RunRoot -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
      if (($_.Attributes -band [System.IO.FileAttributes]::ReadOnly) -ne 0) {
        $_.Attributes = ($_.Attributes -bxor [System.IO.FileAttributes]::ReadOnly)
      }
    }
    $RootItem = Get-Item -LiteralPath $RunRoot -Force
    if (($RootItem.Attributes -band [System.IO.FileAttributes]::ReadOnly) -ne 0) {
      $RootItem.Attributes = ($RootItem.Attributes -bxor [System.IO.FileAttributes]::ReadOnly)
    }
    $LongRunRoot = if ($RunRoot.StartsWith('\\?\')) { $RunRoot } else { '\\?\' + $RunRoot }
    [System.IO.Directory]::Delete($LongRunRoot, $true)
  }
}

if ($Verdict -ne 'PASS') { throw "Windows clean launch smoke failed: $Failure (receipt: $ReceiptPath)" }
Write-Output "Windows clean launch smoke: PASS (receipt: $ReceiptPath)"
