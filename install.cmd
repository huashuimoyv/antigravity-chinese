@echo off
cd /d "%~dp0"
node cli.js install
set "result=%errorlevel%"
pause
exit /b %result%
