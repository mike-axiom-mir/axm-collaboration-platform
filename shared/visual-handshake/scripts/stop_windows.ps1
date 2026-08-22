$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$App = Join-Path $Root "app\visual_handshake.py"
$Install = Join-Path $Root "config\install.json"
$DataRoot = $Root
if (Test-Path $Install) {
  try { $DataRoot = (Get-Content $Install -Raw | ConvertFrom-Json).data_root } catch {}
}
$py = Get-Command py.exe -ErrorAction SilentlyContinue
if ($py) { & $py.Source -3 $App --data-root $DataRoot stop; exit $LASTEXITCODE }
$python = Get-Command python.exe -ErrorAction SilentlyContinue
if ($python) { & $python.Source $App --data-root $DataRoot stop; exit $LASTEXITCODE }
throw "Python 3 was not found."
