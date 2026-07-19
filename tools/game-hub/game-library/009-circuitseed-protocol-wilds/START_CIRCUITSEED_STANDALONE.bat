@echo off
cd /d "%~dp0"
set HOST=127.0.0.1
set PORT=8799
node server\server.js
if errorlevel 1 pause
