@echo off
setlocal
cd /d "%~dp0"
start "HEXBOUND server" /min cmd /c "node runtime\server.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8816/games/016/"
endlocal
