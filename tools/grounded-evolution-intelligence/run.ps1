param(
    [ValidateSet('verify','tests','probe-module1','rebuild-state')]
    [string]$Action = 'verify',
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ModuleArgs
)
$ErrorActionPreference = 'Stop'
$WorkshopRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Python = Join-Path $WorkshopRoot 'runtime\python\capability-intelligence\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) { throw 'Capability intelligence runtime is missing. Run shared/capability-intelligence/bootstrap-runtime.ps1.' }
$env:PYTHONUTF8 = '1'
$env:PYTHONDONTWRITEBYTECODE = '1'
$Engine = Join-Path $PSScriptRoot 'engine'
Push-Location $Engine
try {
    switch ($Action) {
        'verify' { & $Python verify_package.py @ModuleArgs }
        'tests' { & $Python -m unittest discover -s tests -p 'test_*.py' -v @ModuleArgs }
        'probe-module1' {
            $Bundle = Join-Path $WorkshopRoot 'intakes\tri-20260809\source-zips\AXM_HUMAN_CAPABILITY_ATLAS_FINAL_LOCAL_INTAKE_v0_11_0.zip'
            & $Python (Join-Path $WorkshopRoot 'shared\capability-intelligence\trio.py') probe-module1 $Bundle @ModuleArgs
        }
        'rebuild-state' { & $Python scripts\rebuild_state.py @ModuleArgs }
    }
    exit $LASTEXITCODE
} finally { Pop-Location }
