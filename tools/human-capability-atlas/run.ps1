$ErrorActionPreference = 'Stop'
$WorkshopRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Python = Join-Path $WorkshopRoot 'runtime\python\capability-intelligence\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) { throw 'Capability intelligence runtime is missing. Run shared/capability-intelligence/bootstrap-runtime.ps1.' }
$env:PYTHONUTF8 = '1'
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONPATH = Join-Path $PSScriptRoot 'engine\src'
Push-Location (Join-Path $PSScriptRoot 'engine')
try { & $Python -m axm_capability_atlas.cli @args; exit $LASTEXITCODE }
finally { Pop-Location }
