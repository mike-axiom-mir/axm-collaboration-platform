@echo off
title AXM Robo Pong 2-Human Test v0.6.5 WSH Fix
cd /d "%~dp0"

echo.
echo ============================================================
echo  AXM ROBO PONG PHASER 4 - SIMPLE BAT P2 COMPUTER CONTROLS UP TEST v0.6.5
echo ============================================================
echo.
echo No npm. No Vite. No node_modules.
echo Simple RTS-style BAT server.
echo Includes first Robo Pong asset pack and P1 vs BYTE-BUD computer controls.
echo.
echo Requirement: Node.js installed.
echo Optional: vendor\phaser.min.js for fully local Phaser.
echo If vendor\phaser.min.js is missing, the browser will try the online CDN.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js first, then run this BAT again.
  pause
  exit /b 1
)

node robo-pong-simple-bat-server.cjs

echo.
echo Server stopped. Press any key to close.
pause >nul
