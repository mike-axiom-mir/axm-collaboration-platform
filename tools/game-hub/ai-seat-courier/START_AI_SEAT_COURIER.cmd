@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_AI_SEAT_COURIER.ps1"
if errorlevel 1 pause
