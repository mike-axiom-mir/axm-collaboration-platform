@echo off
setlocal
set PYTHONDONTWRITEBYTECODE=1
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0scripts\self_test.py"
) else (
  python "%~dp0scripts\self_test.py"
)
if errorlevel 1 (
  echo.
  echo SELF-TEST FAILED. Do not mark the module ready.
  pause
  exit /b 1
)
echo.
echo SELF-TEST PASSED.
pause
