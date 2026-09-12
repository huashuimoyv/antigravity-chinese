@echo off
cd /d "%~dp0"
set "NODE_CMD=node"
if exist "%~dp0bin\node.exe" set "NODE_CMD=%~dp0bin\node.exe"
if exist "%~dp0node.exe" set "NODE_CMD=%~dp0node.exe"
"%NODE_CMD%" cli.js install
set "result=%errorlevel%"
pause
exit /b %result%
