param(
  [Parameter(Mandatory=$true)][string]$ZipPath,
  [Parameter(Mandatory=$true)][string]$OutputDir,
  [Parameter(Mandatory=$true)][string]$BaseName
)

$ErrorActionPreference = 'Stop'
$ZipPath = [System.IO.Path]::GetFullPath($ZipPath)
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
$TestRoot = [System.IO.Path]::GetFullPath((Join-Path $OutputDir '.restore-tests'))
$RestoreLeaf = 'rt-' + (($BaseName -split '-')[-1])
$RestorePath = [System.IO.Path]::GetFullPath((Join-Path $TestRoot $RestoreLeaf))
$ReportPath = [System.IO.Path]::GetFullPath((Join-Path $OutputDir ($BaseName + '.RESTORE_TEST.json')))
$startedAt = (Get-Date).ToString('o')
$serverProcess = $null

function Assert-Under([string]$Child,[string]$Parent) {
  $childFull = [System.IO.Path]::GetFullPath($Child)
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  if (-not $childFull.StartsWith($parentFull,[System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Restore-test safety refusal: path escaped expected parent: $childFull"
  }
}

function Write-Report([bool]$Ok,[string]$Stage,[string]$Detail,[hashtable]$Extra) {
  $report = [ordered]@{
    schema = 'axm.workshop-restore-test/v1'
    ok = $Ok
    archive = [System.IO.Path]::GetFileName($ZipPath)
    tested_at = (Get-Date).ToString('o')
    stage = $Stage
    detail = $Detail
    temporary_copy_removed = $false
  }
  if ($Extra) { foreach ($key in $Extra.Keys) { $report[$key] = $Extra[$key] } }
  $report | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
  return $report
}

Assert-Under $ZipPath $OutputDir
Assert-Under $TestRoot $OutputDir
Assert-Under $RestorePath $TestRoot
Assert-Under $ReportPath $OutputDir
if ((Split-Path -Leaf $RestorePath) -ne $RestoreLeaf -or $RestoreLeaf -notlike 'rt-*' -or $BaseName -notlike 'axm-workshop-*') {
  throw 'Restore-test safety refusal: unexpected package name.'
}
if (-not (Test-Path -LiteralPath $ZipPath)) { throw 'Restore-test archive missing.' }
if (Test-Path -LiteralPath $RestorePath) { throw 'Restore-test destination already exists.' }

try {
  New-Item -ItemType Directory -Force -Path $TestRoot | Out-Null
  # Windows PowerShell's Expand-Archive can fail during its own cleanup when a
  # large archive contains a path it has already expanded.  The .NET extractor
  # is deterministic here because RestorePath is guaranteed to be new.
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath,$RestorePath)

  $manifestFiles = @(Get-ChildItem -LiteralPath $RestorePath -Recurse -File -Filter 'PACKAGE_MANIFEST.json' -Force)
  if ($manifestFiles.Count -ne 1) { throw "Expected one PACKAGE_MANIFEST.json, found $($manifestFiles.Count)." }
  $restoredRoot = Split-Path -Parent $manifestFiles[0].FullName
  Assert-Under $restoredRoot $RestorePath
  $manifest = Get-Content -LiteralPath $manifestFiles[0].FullName -Raw | ConvertFrom-Json
  if ($manifest.schema -ne 'axm.workshop-package/v1') { throw 'Unexpected package manifest schema.' }

  $checked = 0
  foreach ($entry in @($manifest.files)) {
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $restoredRoot ([string]$entry.path).Replace('/','\')))
    Assert-Under $candidate $restoredRoot
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { throw "Manifest file missing after restore: $($entry.path)" }
    $item = Get-Item -LiteralPath $candidate
    if ([int64]$item.Length -ne [int64]$entry.bytes) { throw "Size mismatch after restore: $($entry.path)" }
    $hash = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne ([string]$entry.sha256).ToLowerInvariant()) { throw "SHA-256 mismatch after restore: $($entry.path)" }
    $checked++
  }
  if ($checked -ne [int]$manifest.file_count) { throw "Manifest count mismatch: checked $checked of $($manifest.file_count)." }

  $verifyPath = Join-Path $restoredRoot 'verify.js'
  if (-not (Test-Path -LiteralPath $verifyPath -PathType Leaf)) { throw 'Restored verify.js is missing.' }
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $verifyOutput = @(& $node $verifyPath 2>&1)
  $verifyExit = $LASTEXITCODE
  if ($verifyExit -ne 0) { throw ('Restored AXM verifier failed: ' + (($verifyOutput | Select-Object -Last 8) -join ' ')) }
  $verifyText = $verifyOutput -join "`n"
  $verifyHeadline = 'pass'
  if ($verifyText -match '(\d+)\s+FAIL.+?(\d+)\s+warn') {
    $verifyHeadline = "$($Matches[1]) FAIL · $($Matches[2]) warn"
  }

  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
  $listener.Start()
  $port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
  $listener.Stop()

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = '"server.js" --open=none'
  $psi.WorkingDirectory = $restoredRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.EnvironmentVariables['AXM_PORT'] = [string]$port
  $psi.EnvironmentVariables['AXM_NO_BROWSER'] = '1'
  $serverProcess = New-Object System.Diagnostics.Process
  $serverProcess.StartInfo = $psi
  if (-not $serverProcess.Start()) { throw 'Restored Hub process could not start.' }

  $health = $null
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if ($serverProcess.HasExited) { throw "Restored Hub exited early with code $($serverProcess.ExitCode)." }
    try { $health = Invoke-RestMethod -Uri ("http://127.0.0.1:$port/api/health") -TimeoutSec 2; break }
    catch { Start-Sleep -Milliseconds 250 }
  }
  if (-not $health -or -not $health.ok -or $health.body -ne 'axm-workshop') { throw 'Restored Hub health check did not pass.' }

  $report = Write-Report $true 'complete' 'Archive hashes, AXM verifier, and restored Hub startup passed.' @{
    files_checked = $checked
    verifier = $verifyHeadline
    hub_health = 'pass'
    test_port = $port
    started_at = $startedAt
  }
} catch {
  $report = Write-Report $false 'failed' $_.Exception.Message @{
    started_at = $startedAt
  }
  throw
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    try { & taskkill.exe /PID $serverProcess.Id /T /F | Out-Null } catch { try { $serverProcess.Kill() } catch {} }
  }
  if (Test-Path -LiteralPath $RestorePath) {
    Assert-Under $RestorePath $TestRoot
    if ((Split-Path -Leaf $RestorePath) -eq $RestoreLeaf -and $RestoreLeaf -like 'rt-*' -and $BaseName -like 'axm-workshop-*') {
      Remove-Item -LiteralPath $RestorePath -Recurse -Force
    }
  }
  if (Test-Path -LiteralPath $TestRoot) {
    $remaining = @(Get-ChildItem -LiteralPath $TestRoot -Force)
    if ($remaining.Count -eq 0) { Remove-Item -LiteralPath $TestRoot -Force }
  }
  if ($report -and (Test-Path -LiteralPath $ReportPath)) {
    $saved = Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json
    $saved.temporary_copy_removed = -not (Test-Path -LiteralPath $RestorePath)
    $saved | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    $report = $saved
  }
}

$report | ConvertTo-Json -Compress -Depth 7
