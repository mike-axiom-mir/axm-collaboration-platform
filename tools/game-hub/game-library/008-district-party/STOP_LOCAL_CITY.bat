@echo off
setlocal
cd /d "%~dp0"
if not exist ".axm-district-party.pid" (
  echo No AXM District Party PID file was found. It may already be stopped.
  pause
  exit /b 0
)
set /p AXM_PID=<.axm-district-party.pid
echo %AXM_PID%| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 (
  echo The PID file is invalid. No process was stopped.
  pause
  exit /b 1
)
powershell -NoProfile -Command "$p=Get-CimInstance Win32_Process -Filter 'ProcessId = %AXM_PID%' -ErrorAction SilentlyContinue; if (-not $p) { exit 3 }; if ($p.CommandLine -notmatch 'server[\\/]+server\.js') { exit 4 }; Stop-Process -Id %AXM_PID% -Force -ErrorAction Stop" >nul 2>nul
if errorlevel 4 (
  echo Refusing to stop PID %AXM_PID% because it is not the AXM District Party server.
  pause
  exit /b 1
)
if errorlevel 3 (
  echo Process %AXM_PID% is not running. Removing the stale local PID file.
  del /q ".axm-district-party.pid" >nul 2>nul
  pause
  exit /b 0
)
if errorlevel 1 (
  echo Could not stop AXM District Party process %AXM_PID%. The PID file was retained.
  pause
  exit /b 1
)
echo Stopped AXM District Party process %AXM_PID%.
del /q ".axm-district-party.pid" >nul 2>nul
pause
