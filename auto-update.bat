@echo off
rem TruckQueue auto-update: runs on the SERVER only (start-all.bat starts it when AUTO_UPDATE=1 in backend\.env).
rem Every 60 seconds: if GitHub "main" has a new push, switch this folder to the latest pushed commit.
rem   - commits on the dev machine do nothing until they are pushed
rem   - backend restarts by itself (npm start uses node --watch)
rem   - runs npm install first if package.json / package-lock.json changed
rem   - never overwrites edits made directly on the server: it skips and logs instead
rem start-all.bat runs a copy of this file from _server\ so updating the repo never changes the running script.
rem Log: _server\update.log      Usage: auto-update.bat [once]
setlocal
set "BRANCH=main"
cd /d "%~dp0"
if not exist ".git" cd ..
if not exist ".git" (echo [!] Not inside the TruckQueue folder. & exit /b 1)
if not exist "_server" mkdir "_server"
set "LOG=%CD%\_server\update.log"

if /i "%~1"=="once" (call :check & exit /b 0)

title TruckQueue Updater
echo Watching GitHub branch "%BRANCH%" every 60s. Log: %LOG%
:loop
call :check
timeout /t 60 /nobreak >nul
goto loop

:check
set "NEW="
set "CUR="
git fetch -q origin %BRANCH% >nul 2>&1 || exit /b 0
for /f "delims=" %%H in ('git rev-parse -q --verify origin/%BRANCH% 2^>nul') do set "NEW=%%H"
if not defined NEW exit /b 0
for /f "delims=" %%H in ('git rev-parse HEAD') do set "CUR=%%H"
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BR=%%B"
if "%CUR%"=="%NEW%" if /i "%BR%"=="%BRANCH%" exit /b 0

set "DIRTY="
for /f "delims=" %%L in ('git status --porcelain -uno') do set "DIRTY=1"
if defined DIRTY (
  if not "%NEW%"=="%SKIPPED%" (
    >>"%LOG%" echo %date% %time% [skip] files were edited on the server - not updating to %NEW:~0,7%. Run "git status" here.
    echo [skip] files were edited on the server - see %LOG%
  )
  set "SKIPPED=%NEW%"
  exit /b 0
)

set "NEEDINSTALL="
for /f "delims=" %%F in ('git diff --name-only %CUR% %NEW% -- backend/package.json backend/package-lock.json') do set "NEEDINSTALL=1"
set "SCRIPTS="
for /f "delims=" %%F in ('git diff --name-only %CUR% %NEW% -- start-all.bat auto-update.bat') do set "SCRIPTS=1"

git checkout -q -B %BRANCH% %NEW% || (
  >>"%LOG%" echo %date% %time% [error] git checkout failed for %NEW:~0,7%
  exit /b 0
)
>>"%LOG%" echo %date% %time% [update] %CUR:~0,7% -^> %NEW:~0,7%
echo %date% %time% updated %CUR:~0,7% -^> %NEW:~0,7%
if defined SCRIPTS (
  >>"%LOG%" echo %date% %time% [note] start-all.bat or auto-update.bat changed - close the TruckQueue windows and run start-all.bat again to use them
  echo [note] start-all.bat / auto-update.bat changed - restart start-all.bat when convenient
)

if defined NEEDINSTALL (
  >>"%LOG%" echo %date% %time% [npm] package.json changed - npm install
  pushd backend
  call npm install --no-audit --no-fund >>"%LOG%" 2>&1
  rem npm may rewrite the lock file; keep the committed one so the next update is not blocked
  git checkout -q -- package-lock.json
  rem touch server.js so node --watch restarts with the new packages
  pushd src
  copy /b server.js +,, >nul
  popd
  popd
)
exit /b 0
