@echo off
setlocal
cd /d "%~dp0"
echo Opening direct-file fallback mode...
echo This mode uses a separate browser workspace from localhost port 8765.
start "" "%~dp0app\index.html"
endlocal & exit /b 0
