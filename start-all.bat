@echo off
rem TruckQueue launcher: same file on the dev machine and the server.
rem Machine-specific settings come from backend\.env (not in git):
rem   TUNNEL_NAME set   -> also starts the Cloudflare tunnel (server)
rem   TUNNEL_NAME empty -> backend only (dev)
title TruckQueue Launcher
cd /d "%~dp0"

if not exist "backend\.env" (
  echo [!] backend\.env not found.
  echo     Copy backend\.env.example to backend\.env and fill in this machine's settings.
  pause
  exit /b 1
)

set "TUNNEL_NAME="
set "PUBLIC_URL="
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("backend\.env") do (
  if /i "%%A"=="TUNNEL_NAME" set "TUNNEL_NAME=%%B"
  if /i "%%A"=="PUBLIC_URL" set "PUBLIC_URL=%%B"
)

echo Installing/updating packages (needed after every sync that changes package.json)...
pushd backend
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [!] npm install failed.
  popd
  pause
  exit /b 1
)
popd

echo Starting backend...
start "TruckQueue Backend" cmd /k "cd /d "%~dp0backend" && npm start"

if defined TUNNEL_NAME (
  echo Waiting for backend...
  timeout /t 5 /nobreak >nul
  echo Starting Cloudflare tunnel "%TUNNEL_NAME%"...
  start "TruckQueue Tunnel" cmd /k "cloudflared tunnel run %TUNNEL_NAME%"
)

echo.
echo Local: http://localhost:3000/driver/   Staff: http://localhost:3000/staff/
if defined PUBLIC_URL echo Public: %PUBLIC_URL%/driver/
echo To stop: close the Backend window (and the Tunnel window if open).
timeout /t 5 >nul
