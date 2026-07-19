@echo off
rem Compatibility name kept for people who were told to click "Run AXM All".
rem The safe beginner default opens the complete Workshop Hub; optional AI and
rem specialist runtimes remain explicit choices in START_AXM_FULL.bat.
call "%~dp0OPEN_AXM_WORKSHOP.cmd"
exit /b %ERRORLEVEL%
