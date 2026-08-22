$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $PSScriptRoot
$Base = Join-Path $env:LOCALAPPDATA "AXM\VisualHandshake"
$Program = Join-Path $Base "program"
$Data = Join-Path $Base "data"
$SkillsRoot = Join-Path $env:USERPROFILE ".agents\skills"
$SkillNames = @(
  "axm-visual-handshake",
  "axm-visual-intake",
  "axm-visual-publish",
  "axm-visual-snapshot",
  "axm-visual-runtime"
)
$Rollback = Join-Path $SkillsRoot "_rollback"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$Staging = Join-Path $Base ("program.staging-" + $Stamp)
$SkillStaging = Join-Path $Base ("skills.staging-" + $Stamp)

function Find-Python {
  $py = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($py) {
    & $py.Source -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,9) else 1)"
    if ($LASTEXITCODE -eq 0) { return @{Exe=$py.Source; Prefix=@("-3")} }
  }
  $python = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($python) {
    & $python.Source -c "import sys; raise SystemExit(0 if sys.version_info >= (3,9) else 1)"
    if ($LASTEXITCODE -eq 0) { return @{Exe=$python.Source; Prefix=@()} }
  }
  throw "Python 3.9 or newer was not found. Ask local Codex to connect this module to the platform Python runtime."
}

function Run-Python([hashtable]$Python, [string[]]$Arguments) {
  $AllArgs = @($Python.Prefix) + @($Arguments)
  & $Python.Exe @AllArgs
  if ($LASTEXITCODE -ne 0) { throw "Python validation command failed: $($Arguments -join ' ')" }
}

$Python = Find-Python
New-Item -ItemType Directory -Path $Base,$Data,$Rollback -Force | Out-Null
Remove-Item $Staging,$SkillStaging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Staging -Force | Out-Null

$Include = @("app","scripts","config","docs","integration","axm-module","tests",".agents","README.md","START_HERE.html","ACTION_REPORT.md","CHANGELOG.md","FINAL_VALIDATION.txt","INTAKE_PACKET.json","STATUS.json","START_VISUAL_HANDSHAKE.bat","STOP_VISUAL_HANDSHAKE.bat","SHOW_CODEX_WHAT_I_SEE.bat","OPEN_CODEX_VISUAL.bat","SELF_TEST_WINDOWS.bat","VALIDATE_WINDOWS.bat","RESTORE_PREVIOUS_WINDOWS.bat","CHECKSUMS_SHA256.txt")
foreach ($name in $Include) {
  $src = Join-Path $SourceRoot $name
  if (Test-Path $src) { Copy-Item $src -Destination $Staging -Recurse -Force }
}
New-Item -ItemType Directory -Path (Join-Path $Staging "config") -Force | Out-Null
@{data_root=$Data; installed_at=(Get-Date).ToUniversalTime().ToString("o"); source_root=$SourceRoot} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Staging "config\install.json")

# Validate the complete staged program before replacing any working installation.
Run-Python $Python @((Join-Path $Staging "scripts\validate_release.py"))
Run-Python $Python @((Join-Path $Staging "scripts\self_test.py"))

# Prepare the complete skill suite before touching any installed skill.
New-Item -ItemType Directory -Path $SkillStaging -Force | Out-Null
foreach ($name in $SkillNames) {
  $sourceSkill = Join-Path $Staging ".agents\skills\$name"
  if (-not (Test-Path $sourceSkill)) { throw "Required skill is missing from staged release: $name" }
  Copy-Item $sourceSkill -Destination (Join-Path $SkillStaging $name) -Recurse -Force
}
@{program_root=$Program; data_root=$Data; installed_at=(Get-Date).ToUniversalTime().ToString("o")} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $SkillStaging "axm-visual-handshake\references\install_location.json")

# Stop an older runtime best-effort. A failure does not erase it or its data.
if (Test-Path (Join-Path $Program "scripts\stop_windows.ps1")) {
  try { & (Join-Path $Program "scripts\stop_windows.ps1") | Out-Null } catch { Write-Warning "Older runtime did not stop cleanly; installation will still preserve rollback copies." }
}

$ProgramBackup = $null
$SkillBackup = $null
try {
  if (Test-Path $Program) {
    $ProgramBackup = Join-Path $Base ("program.rollback-" + $Stamp)
    Move-Item $Program $ProgramBackup
  }
  Move-Item $Staging $Program

  $ExistingSkills = @($SkillNames | Where-Object { Test-Path (Join-Path $SkillsRoot $_) })
  if ($ExistingSkills.Count -gt 0) {
    $SkillBackup = Join-Path $Rollback ("axm-visual-handshake-suite-" + $Stamp)
    New-Item -ItemType Directory -Path $SkillBackup -Force | Out-Null
    foreach ($name in $ExistingSkills) {
      Move-Item (Join-Path $SkillsRoot $name) (Join-Path $SkillBackup $name)
    }
  }
  New-Item -ItemType Directory -Path $SkillsRoot -Force | Out-Null
  foreach ($name in $SkillNames) {
    Move-Item (Join-Path $SkillStaging $name) (Join-Path $SkillsRoot $name)
  }
} catch {
  Remove-Item $Program -Recurse -Force -ErrorAction SilentlyContinue
  if ($ProgramBackup -and (Test-Path $ProgramBackup)) { Move-Item $ProgramBackup $Program }
  foreach ($name in $SkillNames) {
    Remove-Item (Join-Path $SkillsRoot $name) -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($SkillBackup -and (Test-Path $SkillBackup)) {
    Get-ChildItem $SkillBackup -Directory | ForEach-Object { Move-Item $_.FullName (Join-Path $SkillsRoot $_.Name) }
  }
  throw
} finally {
  Remove-Item $Staging,$SkillStaging -Recurse -Force -ErrorAction SilentlyContinue
}

$Desktop = [Environment]::GetFolderPath("Desktop")
$Wsh = New-Object -ComObject WScript.Shell
$shortcuts = @(
  @{Name="AXM - Show Codex.lnk"; Args="-NoProfile -ExecutionPolicy Bypass -File `"$Program\scripts\start_windows.ps1`" -Mode capture"; Desc="Capture a window or screen and show local Codex"},
  @{Name="AXM - Codex Show Me.lnk"; Args="-NoProfile -ExecutionPolicy Bypass -File `"$Program\scripts\start_windows.ps1`" -Mode latest"; Desc="Open the newest visual local Codex sent to Mike"}
)
foreach ($item in $shortcuts) {
  $shortcut = $Wsh.CreateShortcut((Join-Path $Desktop $item.Name))
  $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $shortcut.Arguments = $item.Args
  $shortcut.WorkingDirectory = $Program
  $shortcut.Description = $item.Desc
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,167"
  $shortcut.Save()
}
Write-Host "Installed AXM Visual Handshake v0.3.0 locally after staged validation." -ForegroundColor Green
Write-Host "Desktop buttons: AXM - Show Codex and AXM - Codex Show Me"
Write-Host "Codex skills: $($SkillNames -join ', ')"
Write-Host "Exchange history remains in: $Data"
Write-Host "Use RESTORE_PREVIOUS_WINDOWS.bat from the package if the exact-target test fails."
Start-Process "$Program\START_HERE.html"
