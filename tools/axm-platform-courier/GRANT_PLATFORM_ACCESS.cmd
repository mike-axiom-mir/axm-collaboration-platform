@echo off
cd /d "%~dp0"
echo This grants the selected AI platform bounded AXM read, discovery, planning, and deterministic-hand invocation.
echo It does NOT grant shell commands, remote URLs, secrets, or platform mutations.
set /p AXM_PLATFORM_CONFIRM="Type GRANT to continue: "
if /I not "%AXM_PLATFORM_CONFIRM%"=="GRANT" (
  echo Consent not granted.
  pause
  exit /b 2
)
node grant-consent.js --confirm
pause
