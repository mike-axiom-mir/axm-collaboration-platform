@echo off
setlocal
cd /d "%~dp0"
title AXM Visual Mold Foundry v0.9.1 - Local Server

echo.
echo AXM Visual Mold Foundry v0.9.1
echo Checking the local package before launch...
echo.

where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)" >nul 2>nul
  if not errorlevel 1 goto :use_py
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)" >nul 2>nul
  if not errorlevel 1 goto :use_python
)

echo Python was not found.
echo Opening the direct-file fallback.
echo IMPORTANT: direct-file mode uses a separate browser workspace from localhost.
start "" "%~dp0app\index.html"
echo.
echo Install Python 3 later for the more reliable local-server mode.
pause
endlocal
exit /b 3

:use_py
py -3 start_server.py --diagnose
if errorlevel 1 goto :diagnostic_failed
py -3 start_server.py
set "AXM_EXIT=%errorlevel%"
goto :end

:use_python
python start_server.py --diagnose
if errorlevel 1 goto :diagnostic_failed
python start_server.py
set "AXM_EXIT=%errorlevel%"
goto :end

:diagnostic_failed
echo.
echo Launch diagnostics failed. No server was started.
echo Run RUN_DIAGNOSTICS.bat for the complete report.
pause
set "AXM_EXIT=2"

:end
if not defined AXM_EXIT set "AXM_EXIT=0"
endlocal & exit /b %AXM_EXIT%
