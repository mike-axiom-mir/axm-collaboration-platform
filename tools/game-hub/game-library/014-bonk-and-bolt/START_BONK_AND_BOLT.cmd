@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\START_BONK_AND_BOLT.ps1"
endlocal
