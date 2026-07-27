# User-level, reversible background-app optimization for Mike's AXM laptop.
# This script does not require elevation and does not change Windows services,
# drivers, MSI thermal controls, security, networking, or installed packages.

$ErrorActionPreference = 'Stop'

$backgroundRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications'
$packageFamilies = @(
  'Microsoft.YourPhone_8wekyb3d8bbwe',
  'MicrosoftWindows.CrossDevice_cw5n1h2txyewy',
  'Microsoft.MicrosoftOfficeHub_8wekyb3d8bbwe',
  'Claude_pzs8sxrjxfjjc'
)

foreach ($packageFamily in $packageFamilies) {
  $packagePath = Join-Path $backgroundRoot $packageFamily
  New-Item -Path $packagePath -Force | Out-Null
  New-ItemProperty -LiteralPath $packagePath -Name 'Disabled' -PropertyType DWord -Value 1 -Force | Out-Null
  New-ItemProperty -LiteralPath $packagePath -Name 'DisabledByUser' -PropertyType DWord -Value 1 -Force | Out-Null
  Write-Host "Background disabled: $packageFamily"
}

# Microsoft 365 Copilot declares this packaged login task in AppxManifest.xml.
$startupApprovedPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupTasks'
New-Item -Path $startupApprovedPath -Force | Out-Null
$disabledStartupValue = [byte[]](3,0,0,0,0,0,0,0,0,0,0,0)
New-ItemProperty -LiteralPath $startupApprovedPath -Name 'WebViewHostStartupId' -PropertyType Binary -Value $disabledStartupValue -Force | Out-Null
Write-Host 'Login startup disabled: Microsoft 365 Copilot'

# OneDrive's Run entry is already absent and its scheduled tasks are already
# disabled. Keep its per-user startup approval explicitly disabled as well.
$startupRunPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
New-Item -Path $startupRunPath -Force | Out-Null
New-ItemProperty -LiteralPath $startupRunPath -Name 'OneDrive' -PropertyType Binary -Value $disabledStartupValue -Force | Out-Null
Write-Host 'Login startup disabled: OneDrive'

# Disable Microsoft cross-device experiences for this user while preserving
# LAN, Wi-Fi, Bluetooth, USB, local clipboard history, and AXM transports.
$cdpPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CDP'
New-Item -Path $cdpPath -Force | Out-Null
New-ItemProperty -LiteralPath $cdpPath -Name 'RomeSdkChannelUserAuthzPolicy' -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -LiteralPath $cdpPath -Name 'NearShareChannelUserAuthzPolicy' -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -LiteralPath $cdpPath -Name 'EnableRemoteLaunchToast' -PropertyType DWord -Value 0 -Force | Out-Null
Write-Host 'Windows cross-device and Nearby Sharing disabled for this user'

$clipboardPath = 'HKCU:\Software\Microsoft\Clipboard'
New-Item -Path $clipboardPath -Force | Out-Null
New-ItemProperty -LiteralPath $clipboardPath -Name 'EnableCloudClipboard' -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -LiteralPath $clipboardPath -Name 'CloudClipboardAutomaticUpload' -PropertyType DWord -Value 0 -Force | Out-Null
Write-Host 'Cloud clipboard disabled; local clipboard remains available'

Get-Process -Name 'M365Copilot','m365copilot_autostarter','m365copilotwindowsucprovider','PhoneExperienceHost','CrossDeviceService','CrossDeviceResume','OneDrive','OneDriveStandaloneUpdater' -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host 'Completed. MSI controls, drivers, security, and Windows services were not changed.'
