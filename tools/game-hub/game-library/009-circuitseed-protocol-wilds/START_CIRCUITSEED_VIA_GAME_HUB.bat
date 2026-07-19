@echo off
cd /d "%~dp0"
node scripts\start-via-game-hub.js
if errorlevel 1 pause
