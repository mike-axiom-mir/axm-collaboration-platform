@echo off
setlocal
node "%~dp0pr-sequencer-cli.js" %*
exit /b %errorlevel%
