[CmdletBinding()]
param(
  [string]$WorkshopRoot = ''
)

$ErrorActionPreference = 'Stop'
if (-not $WorkshopRoot) { $WorkshopRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')) }
else { $WorkshopRoot = [System.IO.Path]::GetFullPath($WorkshopRoot) }

$ManifestPath = Join-Path $WorkshopRoot 'RUNTIME_MANIFEST.json'
$RuntimeRoot = [System.IO.Path]::GetFullPath((Join-Path $WorkshopRoot 'runtime\node'))
$MarkerPath = Join-Path $WorkshopRoot 'AXM_OFFLINE_FIRST.json'
$Errors = New-Object System.Collections.Generic.List[string]
$Declared = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)

function Add-Failure([string]$Code) {
  if (-not $Errors.Contains($Code)) { $Errors.Add($Code) }
}

function Test-SafeRelative([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value) -or [System.IO.Path]::IsPathRooted($Value) -or $Value.Contains(':') -or $Value.Contains('\')) { return $false }
  foreach ($Part in $Value.Split('/')) {
    if (-not $Part -or $Part -eq '.' -or $Part -eq '..' -or $Part.EndsWith('.') -or $Part.EndsWith(' ')) { return $false }
  }
  return $true
}

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { throw 'RUNTIME_MANIFEST_MISSING' }
if (-not (Test-Path -LiteralPath $MarkerPath -PathType Leaf)) { throw 'OFFLINE_CANDIDATE_MARKER_MISSING' }
if (-not (Test-Path -LiteralPath $RuntimeRoot -PathType Container)) { throw 'RUNTIME_ROOT_MISSING' }

$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$Marker = Get-Content -LiteralPath $MarkerPath -Raw | ConvertFrom-Json
if ($Manifest.schema -ne 'axm.deploy.windows-runtime-manifest.v1') { Add-Failure 'RUNTIME_MANIFEST_SCHEMA_MISMATCH' }
if ($Marker.schema -ne 'axm.deploy.windows-offline-candidate.v1') { Add-Failure 'OFFLINE_CANDIDATE_MARKER_SCHEMA_MISMATCH' }
if ($Marker.bundled_runtime_before_first_launch -ne $true) { Add-Failure 'OFFLINE_RUNTIME_NOT_DECLARED_BUNDLED' }
if ($Marker.automatic_runtime_download -ne $false) { Add-Failure 'OFFLINE_DOWNLOAD_POLICY_INVALID' }
if ($Marker.runtime_manifest_sha256 -ne $Manifest.manifest_sha256) { Add-Failure 'OFFLINE_MARKER_MANIFEST_MISMATCH' }
if ($Manifest.synthetic_fixture -ne $false) { Add-Failure 'SYNTHETIC_RUNTIME_REFUSED' }
if ($Manifest.architecture -notin @('x64','AMD64','arm64','ARM64')) { Add-Failure 'RUNTIME_ARCHITECTURE_UNSUPPORTED' }

$TotalBytes = [int64]0
foreach ($Entry in @($Manifest.entries)) {
  $Relative = [string]$Entry.path
  if (-not (Test-SafeRelative $Relative)) { Add-Failure "RUNTIME_PATH_UNSAFE:$Relative"; continue }
  if (-not $Declared.Add($Relative)) { Add-Failure "RUNTIME_DUPLICATE_PATH:$Relative"; continue }
  $File = [System.IO.Path]::GetFullPath((Join-Path $RuntimeRoot $Relative.Replace('/','\')))
  $Prefix = $RuntimeRoot.TrimEnd('\') + '\'
  if (-not $File.StartsWith($Prefix,[System.StringComparison]::OrdinalIgnoreCase)) { Add-Failure "RUNTIME_PATH_ESCAPE:$Relative"; continue }
  if (-not (Test-Path -LiteralPath $File -PathType Leaf)) { Add-Failure "RUNTIME_FILE_MISSING:$Relative"; continue }
  $Item = Get-Item -LiteralPath $File
  $TotalBytes += $Item.Length
  if ($Item.Length -ne [int64]$Entry.size) { Add-Failure "RUNTIME_SIZE_MISMATCH:$Relative" }
  $Actual = (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($Actual -ne ([string]$Entry.sha256).ToLowerInvariant()) { Add-Failure "RUNTIME_DIGEST_MISMATCH:$Relative" }
}

foreach ($File in Get-ChildItem -LiteralPath $RuntimeRoot -Recurse -File -Force) {
  $Relative = $File.FullName.Substring($RuntimeRoot.Length + 1).Replace('\','/')
  if (-not $Declared.Contains($Relative)) { Add-Failure "RUNTIME_UNDECLARED_FILE:$Relative" }
}
if (-not $Declared.Contains([string]$Manifest.launcher_relative)) { Add-Failure 'RUNTIME_LAUNCHER_NOT_MANIFESTED' }

$Receipt = [ordered]@{
  schema = 'axm.deploy.windows-runtime-verification.v1'
  decision = if ($Errors.Count) { 'HOLD' } else { 'PASS' }
  errors = @($Errors)
  files_verified = $Errors.Count -eq 0
  entries_observed = $Declared.Count
  bytes_observed = $TotalBytes
  runtime_manifest_sha256 = $Manifest.manifest_sha256
  runtime_launcher = if ($Errors.Count) { $null } else { Join-Path $RuntimeRoot ([string]$Manifest.launcher_relative).Replace('/','\') }
  automatic_download = $false
  changes_made = $false
}
$Receipt | ConvertTo-Json -Depth 6 -Compress
if ($Errors.Count) { exit 1 }
