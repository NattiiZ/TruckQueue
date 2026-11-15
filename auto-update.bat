@echo off
rem SERVER only (start-all.bat runs a copy from _server\ when AUTO_UPDATE=1).
rem Every 60s: if GitHub main has a new push, switch to it. Backend restarts itself (node --watch).
rem Skips (and logs) if files were edited on the server. Log: _server\update.log
setlocal
cd /d "%~dp0"
if not exist ".git" cd ..
set "LOG=%CD%\_server\update.log"

if /i "%~1"=="once" (call :check & exit /b 0)
title TruckQueue Updater
:loop
call :check
timeout /t 60 /nobreak >nul
goto loop

:check
set "NEW=" & set "DIRTY=" & set "NPM="
git fetch -q origin main >nul 2>&1 || exit /b 0
for /f %%H in ('git rev-parse origin/main') do set "NEW=%%H"
for /f %%H in ('git rev-parse HEAD') do set "CUR=%%H"
for /f %%B in ('git rev-parse --abbrev-ref HEAD') do set "BR=%%B"
if "%CUR%"=="%NEW%" if "%BR%"=="main" exit /b 0

for /f %%L in ('git status --porcelain -uno') do set "DIRTY=1"
if defined DIRTY (
  if not "%NEW%"=="%SKIPPED%" >>"%LOG%" echo %date% %time% [skip] files edited on the server - run "git status"
  set "SKIPPED=%NEW%"
  exit /b 0
)

for /f %%F in ('git diff --name-only %CUR% %NEW% -- backend/package.json backend/package-lock.json') do set "NPM=1"
git checkout -q -B main %NEW% || exit /b 0
>>"%LOG%" echo %date% %time% [update] %CUR:~0,7% -^> %NEW:~0,7%
if defined NPM (
  pushd backend
  call npm install --no-audit --no-fund >>"%LOG%" 2>&1
  git checkout -q -- package-lock.json
  pushd src & copy /b server.js +,, >nul & popd
  popd
)
exit /b 0
