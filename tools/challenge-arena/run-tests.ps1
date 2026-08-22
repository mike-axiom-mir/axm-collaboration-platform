$ErrorActionPreference = 'Stop'
$toolRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$bundledPython = [System.IO.Path]::GetFullPath((Join-Path $toolRoot '..\..\runtime\python\capability-intelligence\Scripts\python.exe'))

if (Test-Path -LiteralPath $bundledPython -PathType Leaf) {
  $python = $bundledPython
} else {
  $python = (Get-Command py -ErrorAction Stop).Source
}

function Invoke-CheckedPython {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $python @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Python check failed ($LASTEXITCODE): $($Arguments -join ' ')"
  }
}

Push-Location $toolRoot
try {
  Invoke-CheckedPython -m unittest discover -s tests -q
  Invoke-CheckedPython -m pytest -q tests
  Invoke-CheckedPython tools\sync_contract_resources.py --check
  Invoke-CheckedPython tools\verify_runtime_contracts.py
  Invoke-CheckedPython tools\audit_bundle_portability.py --cases 20 --seed 20260816
} finally {
  Pop-Location
}

Write-Output 'Challenge Arena focused verification: PASS'
