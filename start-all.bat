@echo off
title TruckQueue Launcher
cd /d "%~dp0"

echo Starting backend...
start "TruckQueue Backend" cmd /k "cd /d "%~dp0backend" && npm start"

echo Waiting for backend...
timeout /t 5 /nobreak >nul

echo Starting Cloudflare tunnel...
start "TruckQueue Tunnel" cmd /k "cloudflared tunnel run TruckQueue"

echo.
echo Open: https://truckq.natt-server.online/driver/
echo To stop: close the Backend and Tunnel windows.
timeout /t 5 >nul
