@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install_windows.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Nothing should be called integrated until the error is repaired.
  pause
  exit /b 1
)
echo.
echo Installation complete.
pause
