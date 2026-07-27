@echo off
setlocal EnableExtensions
title AXM Workshop
cd /d "%~dp0"

rem BEGINNER FRONT DOOR
rem -------------------
rem Prefer a private portable runtime, then an installed compatible Node.
rem If neither exists, bootstrap a pinned official Node.js LTS archive into
rem this Workshop only. No administrator permission or system install is used.

if not exist "server.js" goto :needs_extract
if exist "AXM_START_REPORT.txt" del /q "AXM_START_REPORT.txt" >nul 2>nul

set "AXM_NODE="
if exist "runtime\node\node.exe" set "AXM_NODE=%CD%\runtime\node\node.exe"
if not defined AXM_NODE (
  where node >nul 2>nul
  if not errorlevel 1 set "AXM_NODE=node"
)

if not defined AXM_NODE (
  if not exist "scripts\bootstrap-windows-runtime.ps1" goto :needs_node
  where powershell.exe >nul 2>nul
  if errorlevel 1 goto :needs_node
  echo.
  echo   AXM needs a local runtime for its first start.
  echo   It will download pinned Node.js LTS files from nodejs.org,
  echo   verify SHA-256, and keep them only inside this Workshop.
  echo   No administrator permission or system installation is used.
  echo.
  powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%CD%\scripts\bootstrap-windows-runtime.ps1" -WorkshopRoot "%CD%"
  if errorlevel 1 goto :runtime_failed
  if exist "runtime\node\node.exe" set "AXM_NODE=%CD%\runtime\node\node.exe"
)

if not defined AXM_NODE goto :runtime_failed
if not defined AXM_PORT set "AXM_PORT=8788"

echo.
echo   AXM Workshop is starting...
echo.
echo   The Hub will open after the local server is ready.
echo   Keep this window open while using AXM.
echo   Close this window to stop the local Workshop server.
echo.

"%AXM_NODE%" server.js --open=hub
set "AXM_EXIT=%ERRORLEVEL%"
if "%AXM_EXIT%"=="0" exit /b 0

call :write_report SERVER_STOPPED "The local server stopped with error code %AXM_EXIT%." "Read docs\BEGINNER_GUIDE.md, then try OPEN_AXM_WORKSHOP.cmd again."
echo.
echo   AXM stopped with error code %AXM_EXIT%.
echo   Read AXM_START_REPORT.txt for repair steps.
echo   Nothing was installed system-wide or uploaded.
echo.
if not "%AXM_NONINTERACTIVE%"=="1" pause
exit /b %AXM_EXIT%

:needs_extract
call :write_report WORKSHOP_NOT_EXTRACTED "AXM cannot find server.js beside the launcher." "Extract the complete GitHub ZIP, open that folder, and run this launcher again."
echo.
echo   AXM cannot find the rest of the Workshop beside this launcher.
echo   Extract the complete ZIP, open the extracted folder, and try again.
echo   Do not run the launcher from inside the ZIP.
echo.
if not "%AXM_NONINTERACTIVE%"=="1" pause
exit /b 2

:needs_node
call :write_report RUNTIME_UNAVAILABLE "Neither Node.js nor Windows PowerShell is available." "Install Node.js LTS from https://nodejs.org/en/download and run this launcher again."
echo.
echo   AXM cannot prepare its local runtime automatically on this computer.
echo   Install Node.js LTS from https://nodejs.org/en/download and try again.
echo   No npm install, account, API key, or AI connection is required.
echo.
if not "%AXM_NONINTERACTIVE%"=="1" pause
exit /b 3

:runtime_failed
call :write_report RUNTIME_BOOTSTRAP_FAILED "The pinned Node.js runtime could not be downloaded or verified." "Check the internet connection, read docs\BEGINNER_GUIDE.md, and run this launcher again."
echo.
echo   AXM refused the runtime because download or verification failed.
echo   Read AXM_START_REPORT.txt, then try again when online.
echo   No unverified runtime was kept.
echo.
if not "%AXM_NONINTERACTIVE%"=="1" pause
exit /b 4

:write_report
>"AXM_START_REPORT.txt" (
  echo AXM START REPORT
  echo ================
  echo Status: %~1
  echo Detail: %~2
  echo Repair: %~3
  echo Privacy: Nothing was uploaded. No administrator permission was requested.
)
exit /b 0
