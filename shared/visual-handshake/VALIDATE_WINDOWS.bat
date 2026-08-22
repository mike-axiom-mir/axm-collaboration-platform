@echo off
setlocal
set PYTHONDONTWRITEBYTECODE=1
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0scripts\validate_release.py"
) else (
  python "%~dp0scripts\validate_release.py"
)
if errorlevel 1 (
  echo.
  echo RELEASE VALIDATION FAILED.
  pause
  exit /b 1
)
echo.
echo RELEASE VALIDATION PASSED.
pause
