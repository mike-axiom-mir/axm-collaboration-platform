$ErrorActionPreference = 'Stop'
$WorkshopRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Python = Join-Path $WorkshopRoot 'runtime\python\capability-intelligence\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) {
    throw 'Capability intelligence runtime is missing. Run shared/capability-intelligence/bootstrap-runtime.ps1.'
}
$env:PYTHONUTF8 = '1'
$env:PYTHONDWRITEBYTECODE = '1'
Push-Location $WorkshopRoot
try {
    & $Python (Join-Path $PSScriptRoot 'pipeline.py') --output (Join-Path $PSScriptRoot 'generated\verified-workflow')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $Python (Join-Path $PSScriptRoot 'trio.py') audit --output (Join-Path $PSScriptRoot 'status.json')
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
