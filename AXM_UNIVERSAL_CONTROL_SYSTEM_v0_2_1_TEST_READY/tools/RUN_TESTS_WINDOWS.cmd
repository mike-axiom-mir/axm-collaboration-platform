@echo off
setlocal
cd /d "%~dp0\.."
node --test tests\*.test.js tests\*.test.cjs
pause
