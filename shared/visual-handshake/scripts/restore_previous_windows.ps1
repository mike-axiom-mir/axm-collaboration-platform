$ErrorActionPreference = "Stop"
$Base = Join-Path $env:LOCALAPPDATA "AXM\VisualHandshake"
$Program = Join-Path $Base "program"
$SkillsRoot = Join-Path $env:USERPROFILE ".agents\skills"
$SkillNames = @(
  "axm-visual-handshake",
  "axm-visual-intake",
  "axm-visual-publish",
  "axm-visual-snapshot",
  "axm-visual-runtime"
)
$SkillRollback = Join-Path $SkillsRoot "_rollback"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$ProgramBackup = Get-ChildItem $Base -Directory -Filter "program.rollback-*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if (-not $ProgramBackup) { throw "No previous AXM Visual Handshake program rollback was found." }

if (Test-Path (Join-Path $Program "scripts\stop_windows.ps1")) {
  try { & (Join-Path $Program "scripts\stop_windows.ps1") | Out-Null } catch { Write-Warning "Current runtime did not stop cleanly." }
}
$Replaced = Join-Path $Base ("program.replaced-" + $Stamp)
if (Test-Path $Program) { Move-Item $Program $Replaced }
try {
  Move-Item $ProgramBackup.FullName $Program
} catch {
  if ((Test-Path $Replaced) -and -not (Test-Path $Program)) { Move-Item $Replaced $Program }
  throw
}

$SkillBackup = Get-ChildItem $SkillRollback -Directory -Filter "axm-visual-handshake-suite-*" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^axm-visual-handshake-suite-\d{8}-' } | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if ($SkillBackup) {
  $SkillReplaced = Join-Path $SkillRollback ("axm-visual-handshake-suite-replaced-" + $Stamp)
  New-Item -ItemType Directory -Path $SkillReplaced -Force | Out-Null
  foreach ($name in $SkillNames) {
    $target = Join-Path $SkillsRoot $name
    if (Test-Path $target) { Move-Item $target (Join-Path $SkillReplaced $name) }
  }
  try {
    Get-ChildItem $SkillBackup.FullName -Directory | ForEach-Object { Move-Item $_.FullName (Join-Path $SkillsRoot $_.Name) }
  } catch {
    foreach ($name in $SkillNames) {
      Remove-Item (Join-Path $SkillsRoot $name) -Recurse -Force -ErrorAction SilentlyContinue
    }
    Get-ChildItem $SkillReplaced -Directory | ForEach-Object { Move-Item $_.FullName (Join-Path $SkillsRoot $_.Name) }
    throw
  }
} else {
  Write-Warning "Program was restored, but no earlier skill suite was found. The restored program remains usable through its desktop buttons."
}
Write-Host "Previous AXM Visual Handshake program and skill suite restored. Exchange history was not changed." -ForegroundColor Green
Write-Host "The replaced program was preserved at: $Replaced"
