# Exact user-level rollback for optimize-background-apps.ps1.

$ErrorActionPreference = 'Continue'

$backgroundRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications'
$packageFamilies = @(
  'Microsoft.YourPhone_8wekyb3d8bbwe',
  'MicrosoftWindows.CrossDevice_cw5n1h2txyewy',
  'Microsoft.MicrosoftOfficeHub_8wekyb3d8bbwe',
  'Claude_pzs8sxrjxfjjc'
)

foreach ($packageFamily in $packageFamilies) {
  $packagePath = Join-Path $backgroundRoot $packageFamily
  if (Test-Path -LiteralPath $packagePath) {
    Remove-ItemProperty -LiteralPath $packagePath -Name 'Disabled' -ErrorAction SilentlyContinue
    Remove-ItemProperty -LiteralPath $packagePath -Name 'DisabledByUser' -ErrorAction SilentlyContinue
    Write-Host "Background override removed: $packageFamily"
  }
}

$startupApprovedPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupTasks'
if (Test-Path -LiteralPath $startupApprovedPath) {
  Remove-ItemProperty -LiteralPath $startupApprovedPath -Name 'WebViewHostStartupId' -ErrorAction SilentlyContinue
}
Write-Host 'Microsoft 365 Copilot startup override removed.'

# Restore the OneDrive StartupApproved value observed before this optimization.
$startupRunPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
if (Test-Path -LiteralPath $startupRunPath) {
  $enabledStartupValue = [byte[]](2,0,0,0,0,0,0,0,0,0,0,0)
  New-ItemProperty -LiteralPath $startupRunPath -Name 'OneDrive' -PropertyType Binary -Value $enabledStartupValue -Force | Out-Null
}

$cdpPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CDP'
if (Test-Path -LiteralPath $cdpPath) {
  New-ItemProperty -LiteralPath $cdpPath -Name 'RomeSdkChannelUserAuthzPolicy' -PropertyType DWord -Value 1 -Force | Out-Null
  New-ItemProperty -LiteralPath $cdpPath -Name 'NearShareChannelUserAuthzPolicy' -PropertyType DWord -Value 0 -Force | Out-Null
  New-ItemProperty -LiteralPath $cdpPath -Name 'EnableRemoteLaunchToast' -PropertyType DWord -Value 1 -Force | Out-Null
}

$clipboardPath = 'HKCU:\Software\Microsoft\Clipboard'
if (Test-Path -LiteralPath $clipboardPath) {
  Remove-ItemProperty -LiteralPath $clipboardPath -Name 'EnableCloudClipboard' -ErrorAction SilentlyContinue
  Remove-ItemProperty -LiteralPath $clipboardPath -Name 'CloudClipboardAutomaticUpload' -ErrorAction SilentlyContinue
}

Write-Host 'Rollback completed. Apps use their Windows defaults after next sign-in.'
