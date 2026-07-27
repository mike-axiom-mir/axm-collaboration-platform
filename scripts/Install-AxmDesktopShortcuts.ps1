$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'Start-AxmSurface.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$iconLibrary = "$env:SystemRoot\System32\imageres.dll"

$shortcuts = @(
  @{ Name = 'AXM Hub'; Mode = 'Hub'; Icon = 13; Description = 'Start the local AXM Hub only.' },
  @{ Name = 'AXM Games'; Mode = 'Games'; Icon = 17; Description = 'Start the AXM Hub and local game runtime.' },
  @{ Name = 'AXM Bridge'; Mode = 'Bridge'; Icon = 15; Description = 'Start the local-only AXM collaboration bridge.' },
  @{ Name = 'AXM Command + Mirror'; Mode = 'CommandMirror'; Icon = 77; Description = 'Start the command center and local Mirror Core.' }
)

foreach ($item in $shortcuts) {
  $path = Join-Path $desktop ($item.Name + '.lnk')
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $powershell
  $shortcut.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $launcher + '" -Mode ' + $item.Mode
  $shortcut.WorkingDirectory = $root
  $shortcut.WindowStyle = 7
  $shortcut.Description = $item.Description
  $shortcut.IconLocation = $iconLibrary + ',' + $item.Icon
  $shortcut.Save()
}

Write-Host ('Installed four AXM launch shortcuts on ' + $desktop)

