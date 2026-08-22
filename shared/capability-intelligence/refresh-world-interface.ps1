$ErrorActionPreference = 'Stop'
$Workshop = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BundledPython = Join-Path $Workshop 'runtime\python\capability-intelligence\Scripts\python.exe'
$Python = if (Test-Path -LiteralPath $BundledPython) { $BundledPython } else { 'python' }

& $Python (Join-Path $PSScriptRoot 'world-interface\sync_world_interface.py')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $Python (Join-Path $PSScriptRoot 'platform_usability.py')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $Python (Join-Path $PSScriptRoot 'world-interface\selftest.py')
exit $LASTEXITCODE
