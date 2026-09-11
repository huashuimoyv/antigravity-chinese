@echo off
cd /d "%~dp0"
node cli.js restore
set "result=%errorlevel%"
pause
exit /b %result%
