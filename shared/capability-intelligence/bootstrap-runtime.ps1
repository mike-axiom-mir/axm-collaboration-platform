$ErrorActionPreference = 'Stop'

$WorkshopRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$RuntimeRoot = [IO.Path]::GetFullPath((Join-Path $WorkshopRoot 'runtime\python\capability-intelligence'))
$ExpectedParent = [IO.Path]::GetFullPath((Join-Path $WorkshopRoot 'runtime\python'))

if (-not $RuntimeRoot.StartsWith($ExpectedParent + [IO.Path]::DirectorySeparatorChar)) {
    throw "Runtime target escaped the workshop runtime directory: $RuntimeRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $RuntimeRoot 'Scripts\python.exe'))) {
    python -m venv $RuntimeRoot
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& (Join-Path $RuntimeRoot 'Scripts\python.exe') -m pip install --disable-pip-version-check -r (Join-Path $PSScriptRoot 'requirements.lock.txt')
exit $LASTEXITCODE
