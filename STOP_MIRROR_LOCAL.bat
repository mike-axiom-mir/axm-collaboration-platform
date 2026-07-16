@echo off
setlocal
cd /d "%~dp0"
node scripts\stop-mirror.js
if errorlevel 1 pause
