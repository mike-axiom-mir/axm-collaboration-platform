@echo off
set "STUDIO=%~dp0OPEN_STUDIO.html"
if not exist "%STUDIO%" (
  echo Studio file not found: %STUDIO%
  pause
  exit /b 1
)
start "AXM AetherFX Visual Effect Fabric" "%STUDIO%"
