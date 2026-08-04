@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel% neq 0 (
  echo Python 3 was not found.
  echo Install Python 3, then run this file again.
  pause
  exit /b 1
)
python server.py --open-browser
if %errorlevel% neq 0 (
  echo.
  echo AXM AI Habitat stopped with an error. See the message above.
)
pause
