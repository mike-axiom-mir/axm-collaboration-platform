@echo off
setlocal
cd /d "%~dp0"
echo AXM Living Globe vNext v0.10 - Shared Island Brief
echo Opening http://127.0.0.1:8765/
echo Press Ctrl+C in this window to stop.
start "" http://127.0.0.1:8765/
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m http.server 8765 --bind 127.0.0.1
) else (
  python -m http.server 8765 --bind 127.0.0.1
)
endlocal
