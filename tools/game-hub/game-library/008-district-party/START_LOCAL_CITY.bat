@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo AXM DISTRICT PARTY could not start: Node.js was not found.
  echo Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo AXM DISTRICT PARTY could not start: Node.js 20 or newer is required.
  node --version
  pause
  exit /b 1
)
set "PORT=8795"
echo AXM DISTRICT PARTY v0.2.6 - USER ART PASS
echo.
echo Host launcher: http://127.0.0.1:8795/
echo Party A screen: http://127.0.0.1:8795/party-screen.html?party=party_a
echo Party B screen: http://127.0.0.1:8795/party-screen.html?party=party_b
echo Health: http://127.0.0.1:8795/health
echo Status: LOCAL LAN ONLY - no public tunnel
echo The server will print a phone LAN URL only if a private address is detected.
echo If Windows Firewall asks, allow PRIVATE networks only.
echo Press Ctrl+C to stop.
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://127.0.0.1:8795/'"
node server\server.js
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" pause
exit /b %EXIT_CODE%
