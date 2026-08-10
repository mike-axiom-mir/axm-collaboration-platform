@echo off
setlocal
node "%~dp0pr-checkpoint-cli.js" %*
exit /b %errorlevel%
