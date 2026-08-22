param([ValidateSet("home","capture","latest")][string]$Mode = "home")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$App = Join-Path $Root "app\visual_handshake.py"
$Install = Join-Path $Root "config\install.json"
$DataRoot = $Root
if (Test-Path $Install) {
  try { $DataRoot = (Get-Content $Install -Raw | ConvertFrom-Json).data_root } catch { $DataRoot = $Root }
}
$Session = Join-Path $DataRoot "runtime\session.json"
function Find-Python {
  $py = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($py) { return @{Exe=$py.Source; Prefix=@("-3")} }
  $python = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($python) { return @{Exe=$python.Source; Prefix=@()} }
  throw "Python 3 was not found. Ask local Codex to connect this module to the platform Python runtime."
}
if (Test-Path $Session) {
  try {
    $s = Get-Content $Session -Raw | ConvertFrom-Json
    $ping = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $s.port + "/api/ping") -TimeoutSec 2
    if ($ping.ok -and $ping.service -eq "axm-visual-handshake") {
      $url = $s.url + "&mode=" + $Mode
      Start-Process $url
      exit 0
    }
  } catch {}
}
$python = Find-Python
$args = @() + $python.Prefix + @($App, "--data-root", $DataRoot, "serve", "--port", "0", "--mode", $Mode)
$argLine = ($args | ForEach-Object { if ($_ -match '[\s"]') { '"' + ($_ -replace '"','\"') + '"' } else { $_ } }) -join ' '
Start-Process -FilePath $python.Exe -ArgumentList $argLine -WorkingDirectory $Root -WindowStyle Hidden | Out-Null
$deadline = (Get-Date).AddSeconds(12)
do {
  Start-Sleep -Milliseconds 250
  if (Test-Path $Session) {
    try {
      $s = Get-Content $Session -Raw | ConvertFrom-Json
      $ping = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $s.port + "/api/ping") -TimeoutSec 2
      if ($ping.ok -and $ping.service -eq "axm-visual-handshake") {
        Start-Process ($s.url + "&mode=" + $Mode)
        exit 0
      }
    } catch {}
  }
} while ((Get-Date) -lt $deadline)
throw "AXM Visual Handshake did not start within 12 seconds. Run SELF_TEST_WINDOWS.bat for details."
