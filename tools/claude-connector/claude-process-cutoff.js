'use strict';

const { spawn } = require('child_process');

/**
 * Terminate Claude Desktop / Claude Code host process trees only.
 * Invoked after a severe guardian trip — not run during module build/selftest.
 */
function scheduleClaudeCutoff() {
  const script = [
    'Start-Sleep -Milliseconds 450',
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'Claude.exe' } | ForEach-Object { try { taskkill.exe /PID $_.ProcessId /T /F | Out-Null } catch {} }"
  ].join('; ');
  const child = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  child.unref();
}

module.exports = { scheduleClaudeCutoff };
