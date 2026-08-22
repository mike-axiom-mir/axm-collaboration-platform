param(
  [string]$Workspace = (Join-Path $PSScriptRoot 'workspace'),
  [string]$HostName = '127.0.0.1',
  [ValidateRange(1, 65535)]
  [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$toolRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$workspaceRoot = [System.IO.Path]::GetFullPath($Workspace)
$bundledPython = [System.IO.Path]::GetFullPath((Join-Path $toolRoot '..\..\runtime\python\capability-intelligence\Scripts\python.exe'))

if (Test-Path -LiteralPath $bundledPython -PathType Leaf) {
  $python = $bundledPython
} else {
  $python = (Get-Command py -ErrorAction Stop).Source
}

Push-Location $toolRoot
try {
  & $python -m axm_challenge_arena --root $workspaceRoot serve --host $HostName --port $Port
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
