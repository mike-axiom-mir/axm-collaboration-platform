param(
  [ValidateSet('full','public','module','delta','offline-windows')][string]$Mode = 'full',
  [ValidateSet('true','false')][string]$KeepCopy = 'false',
  [string]$ScopesBase64 = 'W10=',
  [string]$GitHubRepo = 'mike-axiom-mir/axm-collaboration-platform',
  [string]$GitRef = 'main',
  [string]$RuntimeRoot = '',
  [string]$RuntimeManifestPath = ''
)

$ErrorActionPreference = 'Stop'
$ToolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RestoreScript = Join-Path $ToolDir 'restore-test.ps1'
$PlannerScript = Join-Path $ToolDir 'package-planner.js'
$Root = [System.IO.Path]::GetFullPath((Join-Path $ToolDir '..\..'))
$RuntimeTool = [System.IO.Path]::GetFullPath((Join-Path $Root 'scripts\windows-runtime-bundle.js'))
if (-not $RuntimeRoot) { $RuntimeRoot = Join-Path $Root 'runtime\node' }
if (-not $RuntimeManifestPath) { $RuntimeManifestPath = Join-Path $Root 'runtime\RUNTIME_MANIFEST.json' }
$RuntimeRoot = [System.IO.Path]::GetFullPath($RuntimeRoot)
$RuntimeManifestPath = [System.IO.Path]::GetFullPath($RuntimeManifestPath)
$OutputDir = [System.IO.Path]::GetFullPath((Join-Path $Root 'exports\workshop-packages'))
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Suffix = [Guid]::NewGuid().ToString('N').Substring(0,6)
$BaseName = "axm-workshop-$Mode-$Stamp-$Suffix"
$CopyPath = [System.IO.Path]::GetFullPath((Join-Path $OutputDir $BaseName))
$ZipPath = [System.IO.Path]::GetFullPath((Join-Path $OutputDir ($BaseName + '.zip')))
$PlanPath = [System.IO.Path]::GetFullPath((Join-Path $OutputDir ($BaseName + '.PLAN.json')))
$IsPublicSafe = $Mode -ne 'full'
$plan = $null
$runtimeStage = $null

function Assert-Under([string]$Child,[string]$Parent) {
  $childFull = [System.IO.Path]::GetFullPath($Child)
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  if (-not $childFull.StartsWith($parentFull,[System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Safety refusal: path escaped expected directory: $childFull"
  }
}

function Get-LongPath([string]$Path) {
  $full = [System.IO.Path]::GetFullPath($Path)
  if ($full.StartsWith('\\?\')) { return $full }
  return '\\?\' + $full
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
  [System.IO.Directory]::Delete((Get-LongPath $targetFull),$true)
  if (Test-Path -LiteralPath $Target) { throw "Package cleanup did not remove staging folder: $targetFull" }
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
      $zipEntry = $archive.CreateEntry($entryName,[System.IO.Compression.CompressionLevel]::Optimal)
      $zipEntry.LastWriteTime = [System.DateTimeOffset]::new(1980,1,1,0,0,0,[System.TimeSpan]::Zero)
      $input = [System.IO.File]::OpenRead((Get-LongPath $file.FullName))
      $output = $zipEntry.Open()
      try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
    }
  } finally {
    if ($archive) { $archive.Dispose() }
  }
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

function Copy-PackageFile([string]$Relative) {
  $normalized = ([string]$Relative).Replace('\','/').Trim('/')
  if (-not $normalized -or [System.IO.Path]::IsPathRooted($normalized) -or $normalized.Contains(':') -or ($normalized.Split('/') -contains '..')) {
    throw "Package plan contains an unsafe path: $Relative"
  }
  $source = [System.IO.Path]::GetFullPath((Join-Path $Root $normalized.Replace('/','\')))
  $destination = [System.IO.Path]::GetFullPath((Join-Path $CopyPath $normalized.Replace('/','\')))
  Assert-Under $source $Root
  Assert-Under $destination $CopyPath
  if (-not [System.IO.File]::Exists((Get-LongPath $source))) { throw "Planned source file is missing: $normalized" }
  [System.IO.Directory]::CreateDirectory((Get-LongPath (Split-Path -Parent $destination))) | Out-Null
  [System.IO.File]::Copy((Get-LongPath $source),(Get-LongPath $destination),$true)
}

Assert-Under $CopyPath $OutputDir
Assert-Under $ZipPath $OutputDir
Assert-Under $PlanPath $OutputDir
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path -LiteralPath $CopyPath) { throw 'Safety refusal: new copy path already exists.' }
if (Test-Path -LiteralPath $ZipPath) { throw 'Safety refusal: new ZIP path already exists.' }
if (Test-Path -LiteralPath $PlanPath) { throw 'Safety refusal: new plan path already exists.' }
New-Item -ItemType Directory -Path $CopyPath | Out-Null

try {
  if ($Mode -in @('full','public','offline-windows')) {
    $excludedDirs = @((Join-Path $Root 'exports'))
    if ($IsPublicSafe) {
      $excludedDirs += @(
        (Join-Path $Root 'backups'),(Join-Path $Root 'logs'),(Join-Path $Root 'saves'),
        (Join-Path $Root 'state'),(Join-Path $Root '.claude'),(Join-Path $Root '.codex'),
        (Join-Path $Root '.grok'),(Join-Path $Root '.git'),(Join-Path $Root 'node_modules'),
        (Join-Path $Root 'runtime'),(Join-Path $Root 'sessions'),(Join-Path $Root 'cache'),
        (Join-Path $Root 'tmp'),(Join-Path $Root 'projects'),(Join-Path $Root 'intakes'),
        (Join-Path $Root 'distributions')
      )
      $excludedDirs += Get-ChildItem -LiteralPath $Root -Directory -Force | Where-Object {
        $_.Name -like '_archive_review_*' -or
        $_.Name -like 'AXM_*_WORKING*' -or
        $_.Name -like 'AXM_*_PACK_*' -or
        $_.Name -like 'AXM_AETHERGLASS_VISUAL_ENGINE_*' -or
        $_.Name -like 'AXM_VISUAL_HANDSHAKE_*'
      } | ForEach-Object { $_.FullName }
    }
    $copyArgs = @($Root,$CopyPath,'/E','/COPY:DAT','/DCOPY:DAT','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD') + $excludedDirs
    & robocopy @copyArgs | Out-Null
    $robocopyCode = $LASTEXITCODE
    if ($robocopyCode -gt 7) { throw "Workshop copy failed with robocopy code $robocopyCode" }
  } else {
    if (-not (Test-Path -LiteralPath $PlannerScript -PathType Leaf)) { throw 'Package planner is missing.' }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $plannerArgs = @(
      $PlannerScript,'--root',$Root,'--mode',$Mode,'--scopes-base64',$ScopesBase64,
      '--github-repo',$GitHubRepo,'--git-ref',$GitRef,'--output',$PlanPath
    )
    $plannerOutput = @(& $node @plannerArgs 2>&1)
    if ($LASTEXITCODE -ne 0) { throw ('Package planning failed: ' + (($plannerOutput | Select-Object -Last 8) -join ' ')) }
    if (-not (Test-Path -LiteralPath $PlanPath -PathType Leaf)) { throw 'Package planner produced no plan.' }
    $plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
    if ($plan.schema -ne 'axm.package-plan/v1' -or $plan.mode -ne $Mode) { throw 'Package planner returned an incompatible plan.' }
    foreach ($relative in @($plan.files)) { Copy-PackageFile ([string]$relative) }
    Remove-Item -LiteralPath $PlanPath -Force
  }

  $excludedFiles = @()
  $scanFindings = @()
  if ($IsPublicSafe) {
    # Nested game runtime folders are content and remain packageable. Only the
    # top-level runtime was excluded above. Other private folder names are
    # removed wherever they occur inside a selected scope.
    $privateDirNames = @(
      'exports','backups','logs','saves','state','.claude','.codex','.grok','.git',
      'node_modules','sessions','cache','tmp','projects','intakes','rollback',
      '__pycache__','.pytest_cache','coverage'
    )
    $nestedPrivateDirs = Get-ChildItem -LiteralPath $CopyPath -Recurse -Directory -Force |
      Where-Object { $privateDirNames -contains $_.Name.ToLowerInvariant() } |
      Sort-Object { $_.FullName.Length } -Descending
    foreach ($directory in $nestedPrivateDirs) {
      if (-not (Test-Path -LiteralPath $directory.FullName)) { continue }
      Assert-Under $directory.FullName $CopyPath
      Remove-TreeSafely $directory.FullName $CopyPath
    }
    $sensitiveFiles = Get-ChildItem -LiteralPath $CopyPath -Recurse -File -Force | Where-Object {
      $_.Name -ieq 'bridge-token.txt' -or $_.Name -ieq 'bridge_token.txt' -or
      $_.Name -ieq '.env' -or $_.Name -like '.env.*' -or
      $_.Extension -in @('.pem','.pfx','.key','.log') -or
      $_.Name -like '*.bak' -or $_.Name -like '*.bak-*' -or
      $_.Name -like 'PRIVATE_*' -or $_.Name -ieq 'private-preview.js'
    }
    foreach ($file in $sensitiveFiles) {
      Assert-Under $file.FullName $CopyPath
      $excludedFiles += $file.FullName.Substring($CopyPath.Length + 1).Replace('\','/')
      Remove-Item -LiteralPath $file.FullName -Force
    }

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

    # The public snapshot intentionally omits local/private declaration roots.
    # Rebuild the deterministic City dependency chain against the curated copy
    # before its manifest is hashed so restored verification measures the
    # package itself. Ordering matters: the registry binds the graph digest and
    # the twin surfaces bind both upstream views.
    if ($Mode -in @('public','offline-windows')) {
      $cityNode = (Get-Command node.exe -ErrorAction Stop).Source
      $cityCompilers = @(
        'scripts\compile-city-graph.js',
        'scripts\compile-schema-registry.js',
        'scripts\compile-twin-surfaces.js'
      )
      foreach ($relativeCompiler in $cityCompilers) {
        $cityCompiler = Join-Path $CopyPath $relativeCompiler
        if (-not (Test-Path -LiteralPath $cityCompiler -PathType Leaf)) {
          throw ("Public package City compiler is missing: $relativeCompiler")
        }
        $cityOutput = @(& $cityNode $cityCompiler "--root=$CopyPath" '--write' 2>&1)
        if ($LASTEXITCODE -ne 0) {
          throw ("Public package City dependency refresh failed ($relativeCompiler): " + (($cityOutput | Select-Object -Last 8) -join ' '))
        }
      }
    }

    $textExtensions = @('.js','.cjs','.mjs','.html','.css','.json','.txt','.md','.bat','.cmd','.ps1','.sh','.yml','.yaml','.xml','.toml','.ini')
    $patterns = @(
      @{ Name='private-key'; Regex='-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{32,}' },
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
      [ordered]@{
        ok=$false; mode=$Mode; refused='secret-scan-findings'; findings=$scanFindings;
        created_at=(Get-Date).ToString('o')
      } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $refusalPath -Encoding UTF8
      throw "Public-safe package refused: $($scanFindings.Count) secret-pattern finding(s). See $refusalPath"
    }
  }

  $stagingManifestPath = Join-Path $CopyPath 'PACKAGE_MANIFEST.json'
  if (Test-Path -LiteralPath $stagingManifestPath -PathType Leaf) {
    Assert-Under $stagingManifestPath $CopyPath
    Remove-Item -LiteralPath $stagingManifestPath -Force
  }
  if ($Mode -eq 'module') {
    $guidePath = Join-Path $CopyPath 'BUILD_ON_GUIDE.md'
    $scopeText = if ($plan -and @($plan.scopes).Count) { (@($plan.scopes) | ForEach-Object { '- `' + [string]$_ + '`' }) -join "`n" } else { '- No scope recorded' }
    $guide = @"
# AXM build-on package

This ZIP is a current local Workshop slice prepared for a human or AI to improve without needing an older GitHub copy.

## Selected paths

$scopeText

## Return it safely

1. Keep the Workshop-relative folders exactly as supplied.
2. Change only the selected target you were asked to improve. Other selected paths may be context, so leave them unchanged.
3. Do not edit `PACKAGE_MANIFEST.json`; it is the base ledger used to detect whether the live Workshop changed while you worked.
4. ZIP this top folder again and return the ZIP to **Governed Installer & Update Manager -> Returned build-on ZIP**.
5. The Workshop will compare the return with this exact base, quarantine it for exact-digest review, retain one previous module generation, apply only after Mike's gate, and run the module self-test when available.

Nothing in this package grants install, promotion, publication, or CANON authority.
"@
    Set-Content -LiteralPath $guidePath -Value $guide -Encoding UTF8
  }
  if ($Mode -eq 'offline-windows') {
    if (-not (Test-Path -LiteralPath $RuntimeTool -PathType Leaf)) { throw 'Windows runtime bundle tool is missing.' }
    if (-not (Test-Path -LiteralPath $RuntimeRoot -PathType Container)) { throw 'Verified runtime root is missing. Run the pinned runtime preparation first.' }
    if (-not (Test-Path -LiteralPath $RuntimeManifestPath -PathType Leaf)) { throw 'Runtime manifest is missing. Run the pinned runtime preparation first.' }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $runtimeOutput = @(& $node $RuntimeTool stage --runtime-root $RuntimeRoot --manifest $RuntimeManifestPath --destination (Join-Path $CopyPath 'runtime\node') --candidate-root $CopyPath 2>&1)
    if ($LASTEXITCODE -ne 0) { throw ('Offline runtime staging failed: ' + (($runtimeOutput | Select-Object -Last 8) -join ' ')) }
    try { $runtimeStage = ($runtimeOutput | Select-Object -Last 1) | ConvertFrom-Json }
    catch { throw 'Offline runtime staging returned an invalid receipt.' }
    if ($runtimeStage.decision -ne 'PASS' -or $runtimeStage.bundled_runtime_before_first_launch -ne $true) { throw 'Offline runtime staging did not pass.' }
  }
  $contentFiles = @(Get-ChildItem -LiteralPath $CopyPath -Recurse -File -Force | Sort-Object FullName)
  $manifestEntries = foreach ($file in $contentFiles) {
    [ordered]@{
      path = $file.FullName.Substring($CopyPath.Length + 1).Replace('\','/')
      bytes = $file.Length
      sha256 = Get-Sha256LongPath $file.FullName
    }
  }
  [object[]]$scopes = @()
  [object[]]$removedPaths = @()
  if ($plan) {
    [object[]]$scopes = @($plan.scopes | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    [object[]]$removedPaths = @($plan.removed_paths | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
  }
  $manifest = [ordered]@{
    schema = 'axm.workshop-package/v1'
    mode = $Mode
    package_kind = switch ($Mode) {
      'full' { 'workshop-private-backup' }
      'public' { 'workshop-public-snapshot' }
      'module' { 'workshop-modular-slice' }
      'delta' { 'workshop-github-delta' }
      'offline-windows' { 'workshop-offline-windows-candidate' }
    }
    created_at = (Get-Date).ToString('o')
    source_folder = (Split-Path -Leaf $Root)
    selection = [ordered]@{
      scopes = [object[]]$scopes
      paths_preserved = $true
      dependency_closure = if ($Mode -eq 'offline-windows') { 'complete-public-workshop-plus-verified-runtime' } elseif ($plan -and $plan.dependency_closure) { [string]$plan.dependency_closure } else { 'complete-workshop-mode' }
    }
    baseline = if ($plan -and $plan.baseline) { $plan.baseline } else { $null }
    changed_or_new_files = if ($Mode -eq 'delta') { @($plan.files).Count } else { $null }
    removed_paths = [object[]]$removedPaths
    apply_policy = if ($Mode -eq 'delta') { 'overlay changed/new files; removed paths are advisory and require an explicit steward action' } else { 'preserve Workshop-relative paths' }
    collaboration = if ($Mode -eq 'module') {
      [ordered]@{
        schema='axm.build-on-handoff/v1'
        export_id=$BaseName
        role='current-local-build-on-source'
        intended_return_schema='axm.workshop-package-return/v1'
        return_surface='Governed Installer & Update Manager / Returned build-on ZIP'
        base_binding='PACKAGE_MANIFEST.json file ledger must match the live target before staging and again before apply'
        context_policy='Only the chosen target module may change; return each improved module separately'
        rollback_policy='Retain exactly one previous module generation before replacement'
        post_install_test='Run the installed module selftest when available; expose direct explicit rollback on failure'
        authority='candidate only; exact-digest review, permission and typed confirmation remain required'
      }
    } else { $null }
    file_count = $contentFiles.Count
    total_bytes = if ($contentFiles.Count) { ($contentFiles | Measure-Object Length -Sum).Sum } else { 0 }
    public_safety = if ($IsPublicSafe) {
      [ordered]@{ sensitive_names_removed=[object[]]$excludedFiles; secret_scan='pass'; uploads='none'; bundled_runtime=($Mode -eq 'offline-windows') }
    } else {
      [ordered]@{ classification='private-local-backup'; secret_scan='not-applicable' }
    }
    files = $manifestEntries
    offline_windows = if ($Mode -eq 'offline-windows') {
      [ordered]@{
        stage_receipt = $runtimeStage
        bundled_runtime_before_first_launch = $true
        first_launch_download = $false
        system_runtime_fallback = $false
        physical_proof = $false
        publication_authority = $false
      }
    } else { $null }
  }
  $manifest | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath $stagingManifestPath -Encoding UTF8

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
    package_kind = $manifest.package_kind
    zip_name = $zipItem.Name
    zip_path = $zipItem.FullName
    zip_url = '/exports/workshop-packages/' + $zipItem.Name
    zip_bytes = $zipItem.Length
    kept_copy = $kept
    copy_path = if ($kept) { $CopyPath } else { $null }
    scopes = [object[]]$scopes
    files = $contentFiles.Count
    changed_or_new_files = if ($Mode -eq 'delta') { @($plan.files).Count } else { $null }
    removed_paths = $removedPaths.Count
    github_baseline = if ($plan -and $plan.baseline) { $plan.baseline } else { $null }
    excluded_sensitive_files = $excludedFiles.Count
    secret_scan = if ($IsPublicSafe) { 'pass' } else { 'not-run-private-backup' }
    restore_test = 'pass'
    restore_report = $BaseName + '.RESTORE_TEST.json'
    restore_files_checked = $restoreTest.files_checked
    package_health = $restoreTest.package_health
    restored_hub = $restoreTest.hub_health
    bundled_runtime_before_first_launch = if ($Mode -eq 'offline-windows') { $true } else { $null }
    runtime_manifest_sha256 = if ($Mode -eq 'offline-windows') { [string]$runtimeStage.runtime_stage.runtime_manifest_sha256 } else { $null }
    physical_proof = if ($Mode -eq 'offline-windows') { $false } else { $null }
  } | ConvertTo-Json -Compress -Depth 8
} catch {
  if (Test-Path -LiteralPath $PlanPath) {
    Assert-Under $PlanPath $OutputDir
    Remove-Item -LiteralPath $PlanPath -Force
  }
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
