@echo off
setlocal
node "%~dp0base-refresh-cli.js" %*
exit /b %errorlevel%
