@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 tools\local_product_design.py start
) else (
  python tools\local_product_design.py start
)
echo.
pause
