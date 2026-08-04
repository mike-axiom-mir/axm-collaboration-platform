@echo off
setlocal EnableExtensions
title AXM Offline Proof
cd /d "%~dp0"
if not exist "AXM_OFFLINE_FIRST.json" goto :not_candidate
where powershell.exe >nul 2>nul
if errorlevel 1 goto :no_powershell
echo.
echo   AXM will verify its bundled runtime, start in safe mode twice,
echo   check loopback readiness, stop only the processes it started,
echo   verify port release, and write a local proof receipt.
echo.
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%CD%\scripts\prove-windows-offline.ps1" -WorkshopRoot "%CD%"
exit /b %ERRORLEVEL%
:not_candidate
echo This proof control is available inside an Offline Windows candidate.
exit /b 2
:no_powershell
echo Windows PowerShell is required for the bounded proof collector.
exit /b 3
