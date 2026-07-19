param(
  [ValidateSet('full','public')][string]$Mode = 'full',
  [ValidateSet('true','false')][string]$KeepCopy = 'false'
)

$ErrorActionPreference = 'Stop'
$ToolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RestoreScript = Join-Path $ToolDir 'restore-test.ps1'
$Root = [System.IO.Path]::GetFullPath((Join-Path $ToolDir '..\..'))
$OutputDir = [System.IO.Path]::GetFullPath((Join-Path $Root 'exports\workshop-packages'))
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Suffix = [Guid]::NewGuid().ToString('N').Substring(0,6)
$BaseName = "axm-workshop-$Mode-$Stamp-$Suffix"
$CopyPath = [System.IO.Path]::GetFullPath((Join-Path $OutputDir $BaseName))
$ZipPath = [System.IO.Path]::GetFullPath((Join-Path $OutputDir ($BaseName + '.zip')))

function Assert-Under([string]$Child,[string]$Parent) {
  $childFull = [System.IO.Path]::GetFullPath($Child)
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  if (-not $childFull.StartsWith($parentFull,[System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Safety refusal: path escaped output directory: $childFull"
  }
}

function Remove-TreeSafely([string]$Target,[string]$Parent) {
  if (-not (Test-Path -LiteralPath $Target)) { return }
  Assert-Under $Target $Parent
  $targetFull = [System.IO.Path]::GetFullPath($Target)
  Get-ChildItem -LiteralPath $targetFull -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
    if (($_.Attributes -band [System.IO.FileAttributes]::ReadOnly) -ne 0) {
      $_.Attributes = ($_.Attributes -bxor [System.IO.FileAttributes]::ReadOnly)
    }
  }
  $rootItem = Get-Item -LiteralPath $targetFull -Force
  if (($rootItem.Attributes -band [System.IO.FileAttributes]::ReadOnly) -ne 0) {
    $rootItem.Attributes = ($rootItem.Attributes -bxor [System.IO.FileAttributes]::ReadOnly)
  }
  $longTarget = if ($targetFull.StartsWith('\\?\')) { $targetFull } else { '\\?\' + $targetFull }
  [System.IO.Directory]::Delete($longTarget,$true)
  if (Test-Path -LiteralPath $Target) {
    throw "Package cleanup did not remove staging folder: $targetFull"
  }
}

function New-PackageZip([string]$Source,[string]$Destination) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $Destination) { throw "ZIP destination already exists: $Destination" }
  $sourceFull = [System.IO.Path]::GetFullPath($Source).TrimEnd('\')
  $rootName = Split-Path -Leaf $sourceFull
  $archive = [System.IO.Compression.ZipFile]::Open($Destination,[System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in Get-ChildItem -LiteralPath $sourceFull -Recurse -File -Force | Sort-Object FullName) {
      $relative = $file.FullName.Substring($sourceFull.Length + 1).Replace('\','/')
      $entryName = $rootName + '/' + $relative
      $fileFull = [System.IO.Path]::GetFullPath($file.FullName)
      $longFile = if ($fileFull.StartsWith('\\?\')) { $fileFull } else { '\\?\' + $fileFull }
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $longFile,
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  } finally {
    if ($archive) { $archive.Dispose() }
  }
}

function Get-Sha256LongPath([string]$Path) {
  $fileFull = [System.IO.Path]::GetFullPath($Path)
  $longFile = if ($fileFull.StartsWith('\\?\')) { $fileFull } else { '\\?\' + $fileFull }
  $stream = [System.IO.File]::OpenRead($longFile)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()
  } finally {
    $sha.Dispose()
    $stream.Dispose()
  }
}

Assert-Under $CopyPath $OutputDir
Assert-Under $ZipPath $OutputDir
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path -LiteralPath $CopyPath) { throw 'Safety refusal: new copy path already exists.' }
if (Test-Path -LiteralPath $ZipPath) { throw 'Safety refusal: new ZIP path already exists.' }
New-Item -ItemType Directory -Path $CopyPath | Out-Null

try {
  $excludedDirs = @((Join-Path $Root 'exports'))
  if ($Mode -eq 'public') {
    $excludedDirs += @(
      (Join-Path $Root 'backups'),(Join-Path $Root 'logs'),(Join-Path $Root 'saves'),
      (Join-Path $Root 'state'),(Join-Path $Root '.claude'),(Join-Path $Root '.codex'),
      (Join-Path $Root '.grok'),(Join-Path $Root '.git'),(Join-Path $Root 'node_modules'),
      (Join-Path $Root 'runtime'),(Join-Path $Root 'sessions'),(Join-Path $Root 'cache'),
      (Join-Path $Root 'tmp'),(Join-Path $Root 'projects'),(Join-Path $Root 'intakes')
    )
  }
  $args = @($Root,$CopyPath,'/E','/COPY:DAT','/DCOPY:DAT','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD') + $excludedDirs
  & robocopy @args | Out-Null
  $robocopyCode = $LASTEXITCODE
  if ($robocopyCode -gt 7) { throw "Workshop copy failed with robocopy code $robocopyCode" }

  $excludedFiles = @()
  $scanFindings = @()
  if ($Mode -eq 'public') {
    $privateDirNames = @(
      'exports','backups','logs','saves','state','.claude','.codex','.grok','.git',
      'node_modules','sessions','cache','tmp','projects','intakes'
    )
    $nestedPrivateDirs = Get-ChildItem -LiteralPath $CopyPath -Recurse -Directory -Force | Where-Object { $privateDirNames -contains $_.Name.ToLowerInvariant() } | Sort-Object { $_.FullName.Length } -Descending
    foreach ($directory in $nestedPrivateDirs) {
      if (-not (Test-Path -LiteralPath $directory.FullName)) { continue }
      Assert-Under $directory.FullName $CopyPath
      Remove-Item -LiteralPath $directory.FullName -Recurse -Force
    }
    $sensitiveFiles = Get-ChildItem -LiteralPath $CopyPath -Recurse -File -Force | Where-Object {
      $_.Name -ieq 'bridge-token.txt' -or
      $_.Name -ieq '.env' -or $_.Name -like '.env.*' -or
      $_.Extension -in @('.pem','.pfx','.key','.log') -or
      $_.Name -like 'PRIVATE_*' -or $_.Name -ieq 'private-preview.js'
    }
    foreach ($file in $sensitiveFiles) {
      Assert-Under $file.FullName $CopyPath
      $excludedFiles += $file.FullName.Substring($CopyPath.Length + 1).Replace('\','/')
      Remove-Item -LiteralPath $file.FullName -Force
    }

    # Preserve unpacked, hashed, rights-recorded project art while omitting the
    # redundant nested source archive. The archive duplicates the source set
    # and can push restored Windows paths beyond legacy path limits.
    $publicOmissions = @(
      'tools/game-hub/game-library/008-district-party/assets/source/user_generated/interactable_alpha_pack_2026-07-19/AXM_DISTRICT_PARTY_INTERACTABLE_ALPHA_PACK_2026-07-19.zip'
    )
    foreach ($relative in $publicOmissions) {
      $candidate = Join-Path $CopyPath ($relative.Replace('/','\'))
      if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
      Assert-Under $candidate $CopyPath
      $excludedFiles += $relative
      Remove-Item -LiteralPath $candidate -Force
    }

    $textExtensions = @('.js','.cjs','.mjs','.html','.css','.json','.txt','.md','.bat','.cmd','.ps1','.sh','.yml','.yaml','.xml','.toml','.ini')
    $patterns = @(
      @{ Name='private-key'; Regex='-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----' },
      @{ Name='openai-key'; Regex='\bsk-[A-Za-z0-9_-]{24,}\b' },
      @{ Name='anthropic-key'; Regex='\bsk-ant-[A-Za-z0-9_-]{20,}\b' },
      @{ Name='google-key'; Regex='\bAIza[0-9A-Za-z_-]{20,}\b' },
      @{ Name='github-token'; Regex='\bgh[pousr]_[A-Za-z0-9]{20,}\b' },
      @{ Name='discord-webhook'; Regex='https://(?:canary\.|ptb\.)?(?:discord(?:app)?\.com)/api/webhooks/[0-9]+/[A-Za-z0-9._-]+' },
      @{ Name='private-windows-user-path'; Regex='(?i)C:\\Users\\[^\\\r\n]+' },
      @{ Name='assigned-api-key'; Regex='(?im)^\s*(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY|AXM_BRIDGE_TOKEN)\s*=\s*[^%\s<][^\r\n]{11,}$' }
    )
    foreach ($file in Get-ChildItem -LiteralPath $CopyPath -Recurse -File -Force) {
      if ($file.Length -gt 2MB -or $textExtensions -notcontains $file.Extension.ToLowerInvariant()) { continue }
      $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
      foreach ($pattern in $patterns) {
        if ($content -match $pattern.Regex) {
          $scanFindings += [ordered]@{ path=$file.FullName.Substring($CopyPath.Length + 1).Replace('\','/'); rule=$pattern.Name }
        }
      }
    }
    if ($scanFindings.Count) {
      $refusalPath = Join-Path $OutputDir ($BaseName + '.REFUSED.json')
      [ordered]@{ ok=$false; mode=$Mode; refused='secret-scan-findings'; findings=$scanFindings; created_at=(Get-Date).ToString('o') } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $refusalPath -Encoding UTF8
      throw "Public-safe package refused: $($scanFindings.Count) secret-pattern finding(s). See $refusalPath"
    }
  }

  # The repository may contain a historical package manifest. It cannot be
  # hashed as ordinary content and then overwritten by this package's manifest.
  $stagingManifestPath = Join-Path $CopyPath 'PACKAGE_MANIFEST.json'
  if (Test-Path -LiteralPath $stagingManifestPath -PathType Leaf) {
    Assert-Under $stagingManifestPath $CopyPath
    Remove-Item -LiteralPath $stagingManifestPath -Force
  }
  $contentFiles = Get-ChildItem -LiteralPath $CopyPath -Recurse -File -Force
  $manifestEntries = foreach ($file in $contentFiles) {
    [ordered]@{
      path = $file.FullName.Substring($CopyPath.Length + 1).Replace('\','/')
      bytes = $file.Length
      sha256 = Get-Sha256LongPath $file.FullName
    }
  }
  $manifest = [ordered]@{
    schema = 'axm.workshop-package/v1'
    mode = $Mode
    created_at = (Get-Date).ToString('o')
    source_folder = (Split-Path -Leaf $Root)
    file_count = $contentFiles.Count
    total_bytes = ($contentFiles | Measure-Object Length -Sum).Sum
    public_safety = if ($Mode -eq 'public') { [ordered]@{ sensitive_names_removed=$excludedFiles; secret_scan='pass'; uploads='none' } } else { [ordered]@{ classification='private-local-backup'; secret_scan='not-applicable' } }
    files = $manifestEntries
  }
  $manifest | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $CopyPath 'PACKAGE_MANIFEST.json') -Encoding UTF8

  New-PackageZip $CopyPath $ZipPath
  if (-not (Test-Path -LiteralPath $ZipPath)) { throw 'ZIP creation did not produce an archive.' }
  $zipItem = Get-Item -LiteralPath $ZipPath
  if ($zipItem.Length -lt 100) { throw 'ZIP verification failed: archive is unexpectedly small.' }

  if (-not (Test-Path -LiteralPath $RestoreScript)) { throw 'Restore-test script missing.' }
  $restoreJson = @(& $RestoreScript -ZipPath $ZipPath -OutputDir $OutputDir -BaseName $BaseName) | Select-Object -Last 1
  $restoreTest = $restoreJson | ConvertFrom-Json
  if (-not $restoreTest.ok) { throw 'Restore test did not pass.' }

  $kept = $KeepCopy -eq 'true'
  if (-not $kept) {
    Assert-Under $CopyPath $OutputDir
    if ((Split-Path -Leaf $CopyPath) -notlike 'axm-workshop-*') { throw 'Safety refusal: unexpected cleanup folder name.' }
    Remove-TreeSafely $CopyPath $OutputDir
  }
  [ordered]@{
    ok = $true
    mode = $Mode
    zip_name = $zipItem.Name
    zip_path = $zipItem.FullName
    zip_url = '/exports/workshop-packages/' + $zipItem.Name
    zip_bytes = $zipItem.Length
    kept_copy = $kept
    copy_path = if ($kept) { $CopyPath } else { $null }
    files = $contentFiles.Count
    excluded_sensitive_files = $excludedFiles.Count
    secret_scan = if ($Mode -eq 'public') { 'pass' } else { 'not-run-private-backup' }
    restore_test = 'pass'
    restore_report = $BaseName + '.RESTORE_TEST.json'
    restore_files_checked = $restoreTest.files_checked
    restored_hub = $restoreTest.hub_health
  } | ConvertTo-Json -Compress
} catch {
  if (Test-Path -LiteralPath $CopyPath) {
    Assert-Under $CopyPath $OutputDir
    if ((Split-Path -Leaf $CopyPath) -like 'axm-workshop-*') {
      try { Remove-TreeSafely $CopyPath $OutputDir } catch { Write-Warning $_.Exception.Message }
    }
  }
  if (Test-Path -LiteralPath $ZipPath) {
    Assert-Under $ZipPath $OutputDir
    Remove-Item -LiteralPath $ZipPath -Force
  }
  throw
}
