@echo off
setlocal
title AXM AI Habitat
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_windows.ps1"
if errorlevel 1 (
  echo.
  echo AXM AI Habitat could not start. Review the message above.
  pause
)
