@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo BLOCKED: Node.js 20 or newer is required.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)
echo Starting AXM Style Fabric locally...
node scripts\serve.mjs
if errorlevel 1 (
  echo.
  echo Style Fabric stopped with an error.
  pause
)
endlocal
