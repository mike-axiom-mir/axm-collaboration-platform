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

if not defined AXM_MIRROR_HOME set "AXM_MIRROR_HOME=C:\AXM_MIRROR_LOCAL"
if exist "%AXM_MIRROR_HOME%\modules\mirror-learning-forge\server\server.js" (
  echo   Starting shared AI Learning Forge on port 8801...
  start "AXM AI Learning Forge - TEST" /min /D "%AXM_MIRROR_HOME%\modules\mirror-learning-forge\server" cmd /k "node server.js"
) else (
  echo   AI Learning Forge not installed. Continuing without the optional school.
)
if exist "%AXM_MIRROR_HOME%\modules\axm-native-learning-shell\server\server.js" (
  echo   Starting AXM Native Learning Shell on port 8802...
  start "AXM Mirror Learning - TEST" /min /D "%AXM_MIRROR_HOME%\modules\axm-native-learning-shell\server" cmd /k "node server.js"
) else (
  echo   Mirror Learning shell not installed. Continuing without its optional panel.
)

if /I "%AXM_DISCORD_BRIDGE%"=="1" (
  if exist "tools\discord-bridge\server.js" (
    echo   Starting explicitly enabled Discord Bridge on port 8822 - network session stays paused...
    start "AXM Discord Bridge - OPTIONAL" /min /D "%~dp0tools\discord-bridge" cmd /k "node server.js"
  ) else (
    echo   Discord Bridge requested but not installed. Continuing without it.
  )
) else (
  echo   Discord Bridge installed but dormant. Set AXM_DISCORD_BRIDGE=1 only if you choose to use it later.
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
