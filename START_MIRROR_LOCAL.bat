@echo off
setlocal
cd /d "%~dp0"
title AXM Mirror Seed-0
node runtime\server.js
if errorlevel 1 pause
