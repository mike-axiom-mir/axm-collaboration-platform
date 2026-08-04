@echo off
setlocal
cd /d "%~dp0"
echo Starting SMALL ODDS on http://127.0.0.1:8817/games/017/
node runtime\server.cjs
endlocal
