[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

if (-not $IsWindows -and $env:OS -ne 'Windows_NT') {
  throw 'Windows offline evidence collection requires Windows.'
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputParent = Split-Path -Parent $resolvedOutput
if (-not $outputParent) {
  throw 'OutputPath must include a parent directory.'
}

$adapters = @(Get-NetAdapter -IncludeHidden | Select-Object `
  Name, InterfaceDescription, Status, MacAddress, ifIndex, HardwareInterface)

$defaultRoutes = @(Get-NetRoute | Where-Object {
  $_.DestinationPrefix -eq '0.0.0.0/0' -or $_.DestinationPrefix -eq '::/0'
} | Select-Object ifIndex, InterfaceAlias, DestinationPrefix, NextHop, RouteMetric, State)

$addresses = @(Get-NetIPAddress | Where-Object {
  $_.AddressState -eq 'Preferred' -or $_.AddressState -eq 'Tentative'
} | Select-Object InterfaceAlias, IPAddress, AddressFamily, AddressState)

$dns = @(Get-DnsClientServerAddress | Select-Object InterfaceAlias, AddressFamily, ServerAddresses)
$proxy = Get-ItemProperty `
  -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' `
  -ErrorAction SilentlyContinue
$connections = @(Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | Where-Object {
  $_.RemoteAddress -notin @('127.0.0.1', '::1', '0.0.0.0', '::')
} | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, OwningProcess, State)

$payload = [ordered]@{
  schema = 'axm.deploy.windows-network-evidence.v2'
  evidence_level = 'PHYSICAL_WINDOWS_TARGET'
  target_os = 'Windows'
  architecture = $env:PROCESSOR_ARCHITECTURE
  collector_changes_made = $false
  collected_at = [DateTimeOffset]::UtcNow.ToString('o')
  adapters = $adapters
  default_routes = $defaultRoutes
  active_ip_addresses = @($addresses | ForEach-Object { $_.IPAddress })
  dns_servers = @($dns | ForEach-Object { $_.ServerAddresses } | Where-Object { $_ })
  proxy_enabled = [bool]$proxy.ProxyEnable
  network_requests_observed = $null
  network_observation = [ordered]@{
    method = 'POINT_IN_TIME_ACTIVE_CONNECTION_SNAPSHOT'
    lifecycle_window = $null
    request_count_measured = $false
    outbound_connections = $connections
  }
  interpretation = 'PRECONDITION_SNAPSHOT_ONLY_REQUIRES_LIFECYCLE_TRACE_AND_GATE_REVIEW'
  windows_offline_first_proven = $false
  public_support = $false
}

New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
$payload | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8
Write-Output $resolvedOutput

