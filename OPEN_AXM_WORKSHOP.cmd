@echo off
setlocal
title AXM Workshop
cd /d "%~dp0"

rem BEGINNER FRONT DOOR
rem -------------------
rem Keep this launcher small and dependency-aware. A future portable package
rem can place Node at runtime\node\node.exe; source downloads fall back to the
rem user's normal Node.js installation.

if not exist "server.js" goto :needs_extract

set "AXM_NODE="
if exist "runtime\node\node.exe" set "AXM_NODE=%CD%\runtime\node\node.exe"
if not defined AXM_NODE (
  where node >nul 2>nul
  if not errorlevel 1 set "AXM_NODE=node"
)
if not defined AXM_NODE goto :needs_node

if not defined AXM_PORT set "AXM_PORT=8788"

echo.
echo   AXM Workshop is starting...
echo.
echo   The Hub will open after the local server is ready.
echo   Keep this window open while using AXM.
echo   Close this window to stop the local Workshop server.
echo.

"%AXM_NODE%" server.js --open=hub
set "AXM_EXIT=%ERRORLEVEL%"
if "%AXM_EXIT%"=="0" exit /b 0

echo.
echo   AXM stopped with error code %AXM_EXIT%.
echo   Nothing was installed or uploaded.
echo.
pause
exit /b %AXM_EXIT%

:needs_extract
echo.
echo   AXM cannot find the rest of the Workshop beside this launcher.
echo.
echo   If you downloaded a ZIP from GitHub:
echo     1. Close this window.
echo     2. Right-click the ZIP and choose "Extract All..."
echo     3. Open the extracted folder.
echo     4. Double-click OPEN_AXM_WORKSHOP.cmd again.
echo.
echo   Do not run the launcher from inside the ZIP.
echo.
pause
exit /b 2

:needs_node
echo.
echo   AXM found the Workshop, but Node.js is not available yet.
echo.
echo   Install the free LTS version from:
echo     https://nodejs.org/en/download
echo.
echo   Then double-click OPEN_AXM_WORKSHOP.cmd again.
echo   No npm install, account, API key, or AI connection is required.
echo.
pause
exit /b 3
