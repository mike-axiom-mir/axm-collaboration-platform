@echo off
setlocal
node "%~dp0continuation-cli.js" %*
exit /b %errorlevel%
