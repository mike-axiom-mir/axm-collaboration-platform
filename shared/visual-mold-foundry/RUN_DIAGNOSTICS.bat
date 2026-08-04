@echo off
setlocal
cd /d "%~dp0"
title AXM Visual Mold Foundry v0.9.1 - Diagnostics
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)" >nul 2>nul
  if not errorlevel 1 goto :run_py
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)" >nul 2>nul
  if not errorlevel 1 goto :run_python
)
echo Python 3 was not found. Full diagnostics cannot run.
set "AXM_EXIT=3"
goto :done

:run_py
py -3 tests\run_tests.py
set "AXM_EXIT=%errorlevel%"
goto :done

:run_python
python tests\run_tests.py
set "AXM_EXIT=%errorlevel%"

:done
echo.
pause
endlocal & exit /b %AXM_EXIT%
