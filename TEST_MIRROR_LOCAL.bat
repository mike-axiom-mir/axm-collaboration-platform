@echo off
setlocal
cd /d "%~dp0"
npm test
node scripts\mirror-doctor.js
pause
