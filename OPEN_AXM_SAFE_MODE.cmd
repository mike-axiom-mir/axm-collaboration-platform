@echo off
setlocal EnableExtensions
title AXM Workshop Safe Mode
cd /d "%~dp0"
set "AXM_SAFE_MODE=1"
echo.
echo   AXM SAFE MODE
echo   Diagnostics and read-only pages remain available.
echo   State-changing API routes, game runtimes, sidecars, background growth,
echo   packaging, updates, and installation actions are disabled.
echo.
call "%CD%\OPEN_AXM_WORKSHOP.cmd"
exit /b %ERRORLEVEL%
