@echo off
cd /d "%~dp0"
echo AXM Skin Fabric local visual workshop: http://127.0.0.1:8765
echo Close this window to stop the local server.
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8765
) else (
  python -m http.server 8765
)
