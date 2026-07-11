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

set "AXM_PORT=8788"
echo.
echo   Starting AXM Workshop library...
echo   The browser opens automatically after the server is ready.
echo.
node server.js --open=launcher
set "AXM_EXIT=%ERRORLEVEL%"
if not "%AXM_EXIT%"=="0" pause
exit /b %AXM_EXIT%
