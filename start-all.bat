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
set "AUTO_UPDATE="
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("backend\.env") do (
  if /i "%%A"=="TUNNEL_NAME" set "TUNNEL_NAME=%%B"
  if /i "%%A"=="PUBLIC_URL" set "PUBLIC_URL=%%B"
  if /i "%%A"=="AUTO_UPDATE" set "AUTO_UPDATE=%%B"
)

rem Server only (AUTO_UPDATE=1): get the latest pushed code first, then keep watching for new pushes.
rem The updater runs from a copy in _server\ so a git update never rewrites the script while it is running.
if "%AUTO_UPDATE%"=="1" (
  if not exist "_server" mkdir "_server"
  copy /y "auto-update.bat" "_server\auto-update-run.bat" >nul
  echo Checking for new code on GitHub...
  call "_server\auto-update-run.bat" once
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

if "%AUTO_UPDATE%"=="1" (
  tasklist /v /fi "imagename eq cmd.exe" | find /i "TruckQueue Updater" >nul || (
    echo Starting auto-update watcher...
    start "TruckQueue Updater" /min cmd /c ""%~dp0_server\auto-update-run.bat""
  )
)

echo.
echo Local: http://localhost:3000/driver/   Staff: http://localhost:3000/staff/
if defined PUBLIC_URL echo Public: %PUBLIC_URL%/driver/
echo To stop: close the Backend window (and the Tunnel window if open).
timeout /t 5 >nul
