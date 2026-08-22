param(
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [int]$Delay = 3
)
$ErrorActionPreference = "Stop"
if ($Delay -gt 0) { Start-Sleep -Seconds ([Math]::Min($Delay, 10)) }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
  $parent = Split-Path -Parent $OutputPath
  if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
