@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Get it from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "server.js" (
  echo.
  echo   server.js is missing from: %CD%
  echo.
  pause
  exit /b 1
)

rem Direct Hub uses its own preferred local port, so an older library
rem server cannot capture the request. If 8790 is busy, server.js chooses
rem the next free local port and opens the correct URL itself.
set "AXM_PORT=8790"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $h=Invoke-RestMethod -Uri 'http://127.0.0.1:8790/api/health' -TimeoutSec 2; if(-not ($h.ok -and $h.body -eq 'axm-workshop')){exit 1}" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo   AXM Hub is already running on this D: Workshop.
  start "" "http://127.0.0.1:8790/hub/index.html"
  exit /b 0
)

echo.
echo   Starting AXM Hub directly...
echo   No bypass or manual address is required.
echo.
node server.js --open=hub
set "AXM_EXIT=%ERRORLEVEL%"
if not "%AXM_EXIT%"=="0" pause
exit /b %AXM_EXIT%
