@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js 18 or newer is required.
  echo   Get it from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "runtime\server.js" (
  echo.
  echo   LUX-5 runtime is missing from: %CD%
  echo.
  pause
  exit /b 1
)

echo.
echo   Starting LUX-5 Neon Overdrive locally...
echo   Open http://127.0.0.1:4175/ when the server is ready.
echo   Press Ctrl+C here to stop it. Nothing is uploaded.
echo.
node runtime\server.js
set "LUX5_EXIT=%ERRORLEVEL%"
if not "%LUX5_EXIT%"=="0" pause
exit /b %LUX5_EXIT%
