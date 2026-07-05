@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Get it from https://nodejs.org
  echo   ^(same install the AI Bridge needs — one install covers both^)
  echo.
  pause
  exit /b 1
)
start "" http://127.0.0.1:8788
node server.js
pause
