@echo off
setlocal
cd /d "%~dp0"
title Casino Alpha - Local Test
node alpha\runtime\casino-server.cjs
if errorlevel 1 pause
endlocal
