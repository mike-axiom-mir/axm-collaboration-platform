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

set "AXM_GAME_PACKAGES_OK=1"
if exist "tools\game-hub\game-package-verifier.js" (
  echo   Checking modular game packages...
  node "tools\game-hub\game-package-verifier.js"
  if errorlevel 1 set "AXM_GAME_PACKAGES_OK=0"
)

if exist "bridge\axm-bridge.js" (
  echo   Starting AXM Bridge in a separate window...
  start "AXM Bridge - close this window to cut AI access" /D "%~dp0bridge" cmd /k "node axm-bridge.js"
) else (
  echo   Bridge not found. Starting Workshop without it.
)

if "%AXM_GAME_PACKAGES_OK%"=="1" (
  if exist "tools\game-hub\game-hub-server.js" (
    echo   Starting AXM Game Hub runtime on port 8789...
    start "AXM Game Hub Runtime" /min /D "%~dp0tools\game-hub" cmd /k "set AXM_GAME_HUB_PORT=8789&& node game-hub-server.js"
  ) else (
    echo   Game Hub runtime not found. Continuing without game launch support.
  )
) else (
  echo   Game package verification failed. Game Hub will stay offline.
  echo   Bridge, Studio, Hub, and unrelated tools will still start.
)

set "AXM_PORT=8788"
echo.
echo   Starting AXM Workshop library...
echo   The browser opens automatically after the server is ready.
echo.
node server.js --open=hub
set "AXM_EXIT=%ERRORLEVEL%"
if not "%AXM_EXIT%"=="0" pause
exit /b %AXM_EXIT%
