@echo off
rem ============================================================
rem AXM WORKSHOP + BRIDGE — one double-click, two separate bodies
rem Workshop (keyless, port 8788) + Bridge (key holder, port 8787)
rem SETUP ONCE: copy the /bridge folder from the prehub zip into
rem this AXM_WORKSHOP folder, so bridge\axm-bridge.js exists.
rem ============================================================
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org
  pause & exit /b 1
)

if not exist "bridge\axm-bridge.js" (
  echo [bridge] not found - copy the /bridge folder from the prehub
  echo          zip into this folder. Starting WORKSHOP ONLY.
) else (
  if "%ANTHROPIC_API_KEY%"=="" if "%OPENAI_API_KEY%"=="" (
    echo [bridge] found, but no ANTHROPIC_API_KEY or OPENAI_API_KEY is set.
    echo          Starting bridge anyway so /health and honest no-key errors work.
    echo          Add keys later in this same Command Prompt for real AI calls.
  )
  echo [bridge] starting in its own window - the ONLY process holding API keys.
  start "AXM Bridge (key holder - close me to cut AI)" node bridge\axm-bridge.js
)

start "" http://127.0.0.1:8788
echo [workshop] starting - keyless by design.
node server.js
pause
