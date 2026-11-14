@echo off
rem Background backend (used by the boot task). Logs go to ..\logs\server.log
if not exist "%~dp0..\logs" mkdir "%~dp0..\logs"
cd /d "%~dp0..\backend"
"C:\Program Files\nodejs\node.exe" --watch src/server.js >> "%~dp0..\logs\server.log" 2>&1
