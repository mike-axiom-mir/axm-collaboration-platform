$ErrorActionPreference = 'Stop'

$moduleRoot = Split-Path -Parent $PSScriptRoot
$runner = $null
$runnerPrefix = @()

$pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
if ($pythonCommand) {
    $runner = $pythonCommand.Source
} else {
    $pyCommand = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($pyCommand) {
        $runner = $pyCommand.Source
        $runnerPrefix = @('-3')
    }
}

if (-not $runner -and $env:USERPROFILE) {
    $bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (Test-Path -LiteralPath $bundledPython -PathType Leaf) {
        $runner = $bundledPython
    }
}

if (-not $runner) {
    throw 'Python 3 was not found. Install Python 3 or open this module through a Codex desktop workspace that provides the bundled runtime.'
}

$previousLocation = Get-Location
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONUTF8 = '1'
try {
    Set-Location -LiteralPath $moduleRoot
    $version = & $runner @runnerPrefix --version 2>&1
    Write-Host "AXM AI Habitat is using $version" -ForegroundColor Cyan
    Write-Host 'Habitat: http://127.0.0.1:8765' -ForegroundColor Green
    Write-Host 'Workshop presence: automatic loopback discovery on ports 8788-8808' -ForegroundColor DarkCyan
    Write-Host 'Close this window or press Ctrl+C to stop.' -ForegroundColor Yellow
    Write-Host ''
    & $runner @runnerPrefix (Join-Path $moduleRoot 'workshop_runtime.py') --open-browser
    exit $LASTEXITCODE
} finally {
    Set-Location -LiteralPath $previousLocation
}
