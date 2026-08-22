@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restore_previous_windows.ps1"
if errorlevel 1 (
  echo.
  echo RESTORE FAILED. No exchange history should have been deleted.
  pause
  exit /b 1
)
echo.
echo Previous version restored.
pause
