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

function Get-LongPath([string]$Path) {
  $full = [System.IO.Path]::GetFullPath($Path)
  if ($full.StartsWith('\\?\')) { return $full }
  return '\\?\' + $full
}

function Get-Sha256LongPath([string]$Path) {
  $stream = [System.IO.File]::OpenRead((Get-LongPath $Path))
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()
  } finally {
    $sha.Dispose()
    $stream.Dispose()
  }
}

function Remove-TreeSafely([string]$Target,[string]$Parent) {
  if (-not (Test-Path -LiteralPath $Target)) { return }
  Assert-Under $Target $Parent
  Get-ChildItem -LiteralPath $Target -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
    if (($_.Attributes -band [System.IO.FileAttributes]::ReadOnly) -ne 0) {
      $_.Attributes = ($_.Attributes -bxor [System.IO.FileAttributes]::ReadOnly)
    }
  }
  $rootItem = Get-Item -LiteralPath $Target -Force
  if (($rootItem.Attributes -band [System.IO.FileAttributes]::ReadOnly) -ne 0) {
    $rootItem.Attributes = ($rootItem.Attributes -bxor [System.IO.FileAttributes]::ReadOnly)
  }
  [System.IO.Directory]::Delete((Get-LongPath $Target),$true)
}

function Expand-PackageZip([string]$ArchivePath,[string]$Destination) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Directory]::CreateDirectory((Get-LongPath $Destination)) | Out-Null
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    foreach ($entry in $archive.Entries) {
      $relative = $entry.FullName.Replace('/','\')
      $target = [System.IO.Path]::GetFullPath((Join-Path $Destination $relative))
      Assert-Under $target $Destination
      if ([string]::IsNullOrEmpty($entry.Name)) {
        [System.IO.Directory]::CreateDirectory((Get-LongPath $target)) | Out-Null
        continue
      }
      $parent = Split-Path -Parent $target
      [System.IO.Directory]::CreateDirectory((Get-LongPath $parent)) | Out-Null
      $input = $entry.Open()
      $output = [System.IO.File]::Create((Get-LongPath $target))
      try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
    }
  } finally {
    $archive.Dispose()
  }
}

function Assert-SafeRelative([string]$Relative,[string]$Label) {
  $normalized = $Relative.Replace('\','/').Trim('/')
  if (-not $normalized -or [System.IO.Path]::IsPathRooted($normalized) -or $normalized.Contains(':') -or ($normalized.Split('/') -contains '..')) {
    throw "$Label contains an unsafe path: $Relative"
  }
  return $normalized
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
  $report | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
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
  Expand-PackageZip $ZipPath $RestorePath

  $restoredRoot = [System.IO.Path]::GetFullPath((Join-Path $RestorePath $BaseName))
  Assert-Under $restoredRoot $RestorePath
  $manifestPath = [System.IO.Path]::GetFullPath((Join-Path $restoredRoot 'PACKAGE_MANIFEST.json'))
  Assert-Under $manifestPath $restoredRoot
  if (-not [System.IO.File]::Exists((Get-LongPath $manifestPath))) { throw 'Expected package manifest is missing.' }
  $manifest = [System.IO.File]::ReadAllText((Get-LongPath $manifestPath)) | ConvertFrom-Json
  if ($manifest.schema -ne 'axm.workshop-package/v1') { throw 'Unexpected package manifest schema.' }
  if ($manifest.mode -notin @('full','public','module','delta')) { throw 'Unexpected package mode.' }

  $checked = 0
  $manifestPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in @($manifest.files)) {
    $relative = Assert-SafeRelative ([string]$entry.path) 'manifest'
    if (-not $manifestPaths.Add($relative)) { throw "Duplicate manifest path: $relative" }
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $restoredRoot $relative.Replace('/','\')))
    Assert-Under $candidate $restoredRoot
    $longCandidate = Get-LongPath $candidate
    if (-not [System.IO.File]::Exists($longCandidate)) { throw "Manifest file missing after restore: $relative" }
    $itemLength = [System.IO.FileInfo]::new($longCandidate).Length
    if ([int64]$itemLength -ne [int64]$entry.bytes) { throw "Size mismatch after restore: $relative" }
    $hash = Get-Sha256LongPath $candidate
    if ($hash -ne ([string]$entry.sha256).ToLowerInvariant()) { throw "SHA-256 mismatch after restore: $relative" }
    $checked++
  }
  if ($checked -ne [int]$manifest.file_count) { throw "Manifest count mismatch: checked $checked of $($manifest.file_count)." }

  $removed = @($manifest.removed_paths | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
  foreach ($entry in $removed) { $null = Assert-SafeRelative ([string]$entry) 'removed-path ledger' }

  $isWholeWorkshop = $manifest.mode -in @('full','public')
  if (-not $isWholeWorkshop) {
    if ($manifest.mode -eq 'module') {
      $scopes = @($manifest.selection.scopes)
      if (-not $scopes.Count) { throw 'Modular package has no selected scopes.' }
      foreach ($scopeValue in $scopes) {
        $scope = Assert-SafeRelative ([string]$scopeValue) 'scope'
        $found = @($manifestPaths | Where-Object { $_ -eq $scope -or $_.StartsWith($scope + '/', [System.StringComparison]::OrdinalIgnoreCase) }).Count
        if (-not $found) { throw "Selected scope has no restored files: $scope" }
      }
    }
    if ($manifest.mode -eq 'delta' -and $checked -eq 0 -and $removed.Count -eq 0) {
      throw 'Delta package contains neither changed files nor a removal ledger.'
    }
    $report = Write-Report $true 'complete' 'Archive paths and hashes passed scoped-package restore verification.' @{
      files_checked = $checked
      package_kind = [string]$manifest.package_kind
      package_health = 'pass'
      scope_health = 'pass'
      removed_paths_checked = $removed.Count
      beginner_launcher = 'not-applicable'
      verifier = 'not-applicable-partial-package'
      hub_health = 'not-applicable-partial-package'
      started_at = $startedAt
    }
  } else {
    $verifyPath = Join-Path $restoredRoot 'verify.js'
    if (-not (Test-Path -LiteralPath $verifyPath -PathType Leaf)) { throw 'Restored verify.js is missing.' }
    $node = (Get-Command node.exe -ErrorAction Stop).Source

    $beginnerLaunchTest = Join-Path $restoredRoot 'tests\beginner-launch-selftest.js'
    if (-not (Test-Path -LiteralPath $beginnerLaunchTest -PathType Leaf)) { throw 'Restored beginner launch self-test is missing.' }
    $beginnerLaunchOutput = @(& $node $beginnerLaunchTest 2>&1)
    if ($LASTEXITCODE -ne 0) { throw ('Restored beginner launch contract failed: ' + (($beginnerLaunchOutput | Select-Object -Last 8) -join ' ')) }

    $verifyOutput = @(& $node $verifyPath 2>&1)
    if ($LASTEXITCODE -ne 0) {
      $failureEvidence = @($verifyOutput | Where-Object { [string]$_ -match '\bFAIL\b' } | Select-Object -First 20)
      if (-not $failureEvidence.Count) { $failureEvidence = @($verifyOutput | Select-Object -First 4) + @($verifyOutput | Select-Object -Last 8) }
      throw ('Restored AXM verifier failed: ' + ($failureEvidence -join ' '))
    }
    $verifyText = $verifyOutput -join "`n"
    $verifyHeadline = 'pass'
    if ($verifyText -match '(\d+)\s+FAIL.+?(\d+)\s+warn') { $verifyHeadline = "$($Matches[1]) FAIL - $($Matches[2]) warn" }

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

    $report = Write-Report $true 'complete' 'Archive hashes, beginner launcher contract, AXM verifier, and restored Hub startup passed.' @{
      files_checked = $checked
      package_kind = [string]$manifest.package_kind
      package_health = 'pass'
      scope_health = 'complete-workshop'
      removed_paths_checked = $removed.Count
      beginner_launcher = 'pass'
      verifier = $verifyHeadline
      hub_health = 'pass'
      test_port = $port
      started_at = $startedAt
    }
  }
} catch {
  $report = Write-Report $false 'failed' $_.Exception.Message @{ started_at = $startedAt }
  throw
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    try { & taskkill.exe /PID $serverProcess.Id /T /F | Out-Null } catch { try { $serverProcess.Kill() } catch {} }
  }
  if (Test-Path -LiteralPath $RestorePath) {
    Assert-Under $RestorePath $TestRoot
    if ((Split-Path -Leaf $RestorePath) -eq $RestoreLeaf -and $RestoreLeaf -like 'rt-*' -and $BaseName -like 'axm-workshop-*') {
      Remove-TreeSafely $RestorePath $TestRoot
    }
  }
  if (Test-Path -LiteralPath $TestRoot) {
    $remaining = @(Get-ChildItem -LiteralPath $TestRoot -Force)
    if ($remaining.Count -eq 0) { Remove-Item -LiteralPath $TestRoot -Force }
  }
  if ($report -and (Test-Path -LiteralPath $ReportPath)) {
    $saved = Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json
    $saved.temporary_copy_removed = -not (Test-Path -LiteralPath $RestorePath)
    $saved | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    $report = $saved
  }
}

$report | ConvertTo-Json -Compress -Depth 9
