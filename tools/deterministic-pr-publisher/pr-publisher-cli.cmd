@echo off
setlocal
node "%~dp0pr-publisher-cli.js" %*
exit /b %errorlevel%
