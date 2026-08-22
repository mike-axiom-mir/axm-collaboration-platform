@echo off
setlocal
cd /d "%~dp0\.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)
echo Starting AXM Universal Controls v0.2.1 Saturday test...
start "AXM Control Server" cmd /k ""cd /d "%CD%" && node server\reference-server.cjs""
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8787/host"
echo.
echo The host page should now be open.
echo Use the PHONE LAN link printed in the AXM Control Server window.
echo After testing, press DOWNLOAD TEST LOG on the host page.
echo.
pause
