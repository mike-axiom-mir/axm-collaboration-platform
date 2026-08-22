$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$gameUrl = 'http://127.0.0.1:8814/games/014/'
$healthUrl = 'http://127.0.0.1:8814/health'
$serverProcess = $null

try {
  Write-Host 'Starting Bonk & Bolt: The 24th Hour...'
  $serverProcess = Start-Process -FilePath 'node' `
    -ArgumentList 'runtime\server.js' `
    -WorkingDirectory $gameRoot `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    if ($serverProcess.HasExited) {
      throw 'The Bonk & Bolt server stopped before it became ready.'
    }
    try {
      $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
      if ($health.ok -and $health.gameId -eq '014-bonk-and-bolt') {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }

  if (-not $ready) {
    throw 'Bonk & Bolt did not become ready on port 8814.'
  }

  Start-Process $gameUrl
  Write-Host ''
  Write-Host 'The game is running. Keep this window open while you play.'
  Read-Host 'Press Enter here to stop the local game server'
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id
  }
}
