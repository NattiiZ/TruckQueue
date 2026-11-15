@echo off
rem Double-click to check whether the TruckQueue server is working. Can be copied anywhere (e.g. Desktop).
setlocal
title TruckQueue Status
set "SITE=https://truckq.natt-server.online"
set "PROJ=%~dp0"
if not exist "%PROJ%backend\.env" set "PROJ=%USERPROFILE%\Desktop\Coop_FG_Proj\TruckQueue\"
set "FAIL=0"
echo.
echo   TruckQueue status  (%date% %time:~0,5%)
echo   ------------------------------------------

rem --- Server PC: ping + database port (host taken from DB_HOST in backend\.env) ---
set "HOST=" & set "DBPORT=3306"
if exist "%PROJ%backend\.env" for /f "tokens=1,* delims==" %%A in ('findstr /b "DB_HOST= DB_PORT=" "%PROJ%backend\.env"') do (
  if "%%A"=="DB_HOST" set "HOST=%%B"
  if "%%A"=="DB_PORT" set "DBPORT=%%B"
)
if defined HOST (call :serverpc) else echo   Server PC           : skipped - no DB_HOST in backend\.env

rem --- Website ---
curl -s -m 15 "%SITE%/api/health" | findstr /r "ok.:true" >nul
if errorlevel 1 (set "R=FAIL - site, backend or database is down" & set "FAIL=1") else set "R=OK"
echo   Server + database   : %R%
call :page "Driver page        " /driver/
call :page "Staff page         " /staff/
call :page "Companies API      " /api/companies

rem --- Code version ---
set "CUR=" & set "NEW="
pushd "%PROJ%" 2>nul && (
  git fetch -q origin main >nul 2>&1
  for /f %%H in ('git rev-parse --short HEAD 2^>nul') do set "CUR=%%H"
  for /f %%H in ('git rev-parse --short origin/main 2^>nul') do set "NEW=%%H"
  popd
)
if not defined CUR (set "R=skipped - project folder not found") else if "%CUR%"=="%NEW%" (set "R=OK - same as GitHub (%CUR%)") else set "R=differs: here %CUR%, GitHub %NEW%"
echo   Code on this PC     : %R%

echo   ------------------------------------------
if "%FAIL%"=="0" (echo   ALL OK) else (echo   PROBLEM FOUND - check the TruckQueue windows on the server)
echo.
pause
exit /b

:serverpc
set "MS="
for /f "tokens=4 delims==" %%T in ('ping -n 2 -w 2000 %HOST% ^| findstr /c:"Average"') do set "MS=%%T"
if defined MS (echo   Server PC ping      : OK -%MS%) else (echo   Server PC ping      : FAIL - no reply from %HOST% & set "FAIL=1")
powershell -NoProfile -Command "exit !(New-Object Net.Sockets.TcpClient).ConnectAsync('%HOST%',%DBPORT%).Wait(3000)" >nul 2>&1
if errorlevel 1 (echo   Server PC database  : FAIL - port %DBPORT% not reachable & set "FAIL=1") else echo   Server PC database  : OK - port %DBPORT% open
exit /b

:page
set "CODE="
for /f %%C in ('curl -s -m 15 -o nul -w "%%{http_code}" "%SITE%%~2"') do set "CODE=%%C"
if "%CODE%"=="200" (set "R=OK") else (set "R=FAIL (HTTP %CODE%)" & set "FAIL=1")
echo   %~1 : %R%
exit /b
