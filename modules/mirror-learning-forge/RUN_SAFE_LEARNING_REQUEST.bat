@echo off
setlocal
cd /d "%~dp0"
if "%~2"=="" (
  echo Usage: RUN_SAFE_LEARNING_REQUEST.bat /api/route payload.json [manual^|automatic] [output.json]
  exit /b 2
)
set "AXM_MODE=%~3"
if "%AXM_MODE%"=="" set "AXM_MODE=manual"
if "%~4"=="" (
  node scripts\safe-learning-request.js --route "%~1" --input "%~2" --mode "%AXM_MODE%"
) else (
  node scripts\safe-learning-request.js --route "%~1" --input "%~2" --mode "%AXM_MODE%" --output "%~4"
)
exit /b %ERRORLEVEL%
