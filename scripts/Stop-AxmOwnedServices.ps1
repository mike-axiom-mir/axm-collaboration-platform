param(
  [ValidateRange(0, 10000)]
  [int]$DelayMilliseconds = 750,
  [switch]$ListOnly
)

$ErrorActionPreference = 'Stop'
$workshopRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$bundledNode = [IO.Path]::GetFullPath((Join-Path $workshopRoot 'runtime\node\node.exe'))

if (-not (Test-Path -LiteralPath $bundledNode -PathType Leaf)) {
  throw "AXM bundled runtime is missing: $bundledNode"
}

function Resolve-ProcessPath([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  try { return [IO.Path]::GetFullPath($Value).TrimEnd('\') } catch { return $null }
}

# Executable identity is the ownership boundary. System Node, Codex runtimes,
# and every other node.exe remain outside this list even if their names match.
$ownedNodes = @(
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object {
      $candidate = Resolve-ProcessPath $_.ExecutablePath
      $candidate -and $candidate.Equals($bundledNode, [StringComparison]::OrdinalIgnoreCase)
    } |
    Sort-Object ProcessId
)

$targets = @($ownedNodes | ForEach-Object {
  [pscustomobject]@{
    processId = [int]$_.ProcessId
    parentProcessId = [int]$_.ParentProcessId
    executablePath = $_.ExecutablePath
    commandLine = $_.CommandLine
  }
})

if ($ListOnly) {
  [pscustomobject]@{
    schema = 'axm.owned-runtime-targets/v1'
    workshopRoot = $workshopRoot
    runtimeIdentity = $bundledNode
    targetCount = $targets.Count
    targets = $targets
    mutation = $false
  } | ConvertTo-Json -Depth 5
  exit 0
}

if ($DelayMilliseconds -gt 0) { Start-Sleep -Milliseconds $DelayMilliseconds }

# Remember only direct cmd.exe parents of the verified AXM runtimes. Launcher
# console windows are closed after their child exits; PowerShell/Codex parents
# are deliberately never included.
$ownedCmdParents = @()
foreach ($node in $ownedNodes) {
  $parent = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f [int]$node.ParentProcessId) -ErrorAction SilentlyContinue
  if ($parent -and $parent.Name -ieq 'cmd.exe') { $ownedCmdParents += $parent }
}

foreach ($node in $ownedNodes) {
  Stop-Process -Id ([int]$node.ProcessId) -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 300

foreach ($parent in ($ownedCmdParents | Sort-Object ProcessId -Unique)) {
  Stop-Process -Id ([int]$parent.ProcessId) -ErrorAction SilentlyContinue
}

