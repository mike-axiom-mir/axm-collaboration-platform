[CmdletBinding()]
param(
  [string]$WorkshopRoot = ''
)

$ErrorActionPreference = 'Stop'
$NodeVersion = '24.17.0'
$ReleaseBase = "https://nodejs.org/dist/v$NodeVersion"

if (-not $WorkshopRoot) {
  $WorkshopRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
} else {
  $WorkshopRoot = [System.IO.Path]::GetFullPath($WorkshopRoot)
}

if (-not (Test-Path -LiteralPath (Join-Path $WorkshopRoot 'server.js') -PathType Leaf)) {
  throw "Workshop root does not contain server.js: $WorkshopRoot"
}

$Architecture = [string]$env:PROCESSOR_ARCHITECTURE
if ($Architecture -eq 'AMD64') {
  $ArchiveName = "node-v$NodeVersion-win-x64.zip"
  $ExpectedSha256 = 'f2aa33b35b75aca5f3f7b85675a6f6423201053e9381911e64961f3bda2528ab'
  $ArchiveFolder = "node-v$NodeVersion-win-x64"
} elseif ($Architecture -eq 'ARM64') {
  $ArchiveName = "node-v$NodeVersion-win-arm64.zip"
  $ExpectedSha256 = '4957712f67fce55779cc794d9b4df9e0e802a18c841ad5a4e42f17be490e634d'
  $ArchiveFolder = "node-v$NodeVersion-win-arm64"
} else {
  throw "Automatic AXM runtime bootstrap supports Windows x64 and ARM64; detected $Architecture."
}

$RuntimeRoot = [System.IO.Path]::GetFullPath((Join-Path $WorkshopRoot 'runtime'))
$NodeRoot = [System.IO.Path]::GetFullPath((Join-Path $RuntimeRoot 'node'))
$NodeExecutable = [System.IO.Path]::GetFullPath((Join-Path $NodeRoot 'node.exe'))
$TempParent = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$TempRoot = [System.IO.Path]::GetFullPath((Join-Path $TempParent ('axm-node-bootstrap-' + [Guid]::NewGuid().ToString('N'))))
$ArchivePath = Join-Path $TempRoot $ArchiveName
$ExpandPath = Join-Path $TempRoot 'expanded'
$DownloadUrl = "$ReleaseBase/$ArchiveName"

function Assert-Under([string]$Child, [string]$Parent) {
  $childFull = [System.IO.Path]::GetFullPath($Child)
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  if (-not $childFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Safety refusal: path escaped expected root: $childFull"
  }
}

Assert-Under $RuntimeRoot $WorkshopRoot
Assert-Under $NodeRoot $RuntimeRoot
Assert-Under $TempRoot $TempParent

if (Test-Path -LiteralPath $NodeExecutable -PathType Leaf) {
  $ExistingVersion = (& $NodeExecutable --version 2>$null | Select-Object -First 1)
  if ($LASTEXITCODE -eq 0 -and $ExistingVersion -eq "v$NodeVersion") {
    Write-Output "AXM runtime already verified: $ExistingVersion"
    exit 0
  }
  throw 'A different or damaged private runtime already exists. Remove runtime\node after review, then retry.'
}

New-Item -ItemType Directory -Path $TempRoot | Out-Null
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Write-Output "Downloading pinned Node.js $NodeVersion LTS for $Architecture from nodejs.org..."
  Invoke-WebRequest -UseBasicParsing -Uri $DownloadUrl -OutFile $ArchivePath

  $ActualSha256 = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($ActualSha256 -ne $ExpectedSha256) {
    throw "Node.js archive SHA-256 mismatch. Expected $ExpectedSha256; received $ActualSha256."
  }

  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $ExpandPath
  $ExpandedNode = [System.IO.Path]::GetFullPath((Join-Path $ExpandPath "$ArchiveFolder\node.exe"))
  Assert-Under $ExpandedNode $ExpandPath
  if (-not (Test-Path -LiteralPath $ExpandedNode -PathType Leaf)) {
    throw 'Verified Node.js archive did not contain the expected node.exe.'
  }

  New-Item -ItemType Directory -Force -Path $NodeRoot | Out-Null
  Copy-Item -LiteralPath $ExpandedNode -Destination $NodeExecutable
  $InstalledVersion = (& $NodeExecutable --version 2>$null | Select-Object -First 1)
  if ($LASTEXITCODE -ne 0 -or $InstalledVersion -ne "v$NodeVersion") {
    Remove-Item -LiteralPath $NodeExecutable -Force -ErrorAction SilentlyContinue
    throw "Installed runtime did not report the pinned version v$NodeVersion."
  }

  $Provenance = [ordered]@{
    schema = 'axm.local-runtime-provenance/v1'
    product = 'Node.js'
    version = $NodeVersion
    architecture = $Architecture
    source_url = $DownloadUrl
    archive_sha256 = $ActualSha256
    verified_version = $InstalledVersion
    installed_at = (Get-Date).ToUniversalTime().ToString('o')
    scope = 'private Workshop runtime; excluded from public source sync'
    license = 'https://github.com/nodejs/node/blob/v24.17.0/LICENSE'
  }
  $Provenance | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $NodeRoot 'RUNTIME_PROVENANCE.json') -Encoding UTF8
  Write-Output "AXM runtime ready: $InstalledVersion"
} catch {
  if (Test-Path -LiteralPath $NodeExecutable) {
    Remove-Item -LiteralPath $NodeExecutable -Force -ErrorAction SilentlyContinue
  }
  throw
} finally {
  if (Test-Path -LiteralPath $TempRoot) {
    Assert-Under $TempRoot $TempParent
    Remove-Item -LiteralPath $TempRoot -Recurse -Force
  }
}
