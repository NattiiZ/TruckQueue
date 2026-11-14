@echo off
rem Background Cloudflare tunnel (used by the boot task). Name comes from backend\.env TUNNEL_NAME
if not exist "%~dp0..\logs" mkdir "%~dp0..\logs"
set "TUNNEL_NAME="
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%~dp0..\backend\.env") do if /i "%%A"=="TUNNEL_NAME" set "TUNNEL_NAME=%%B"
if not defined TUNNEL_NAME exit /b 0
"C:\Program Files (x86)\cloudflared\cloudflared.exe" --config C:\Users\natt\.cloudflared\config.yml tunnel run %TUNNEL_NAME% >> "%~dp0..\logs\tunnel.log" 2>&1
