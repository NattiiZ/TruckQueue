@echo off
rem TruckQueue deploy: run on the DEV machine when your changes are finished.
rem   - pushes main to GitHub (backup of your work)
rem   - moves the "release" branch to the same commit
rem The server (auto-update.bat) watches "release" and switches to it within ~1 minute.
rem Pushing main alone (git push / GitHub Desktop) does NOT change the server.
setlocal
title TruckQueue Deploy
cd /d "%~dp0"

where git >nul 2>&1 || (echo [!] git not found in PATH. & goto fail)

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BR=%%B"
if /i not "%BR%"=="main" (
  echo [!] You are on branch "%BR%". Switch to main first.
  goto fail
)

set "DIRTY="
for /f "delims=" %%L in ('git status --porcelain') do set "DIRTY=1"
if defined DIRTY (
  echo [!] There are uncommitted changes. Commit them first:
  git status --short
  goto fail
)

echo Checking GitHub...
git fetch -q origin || (echo [!] Cannot reach GitHub. & goto fail)
git rev-parse -q --verify origin/main >nul && (
  git merge-base --is-ancestor origin/main HEAD || (
    echo [!] GitHub main has commits this machine does not have. Run "git pull" first.
    goto fail
  )
)

echo.
git rev-parse -q --verify origin/release >nul
if errorlevel 1 (
  echo First deploy: the server will get everything up to:
  git log --oneline -1
) else (
  git merge-base --is-ancestor origin/release HEAD || (
    echo [!] release on GitHub is not behind main ^(someone changed it^). Check before deploying.
    goto fail
  )
  echo Changes that will go to the server:
  git log --oneline origin/release..HEAD
  git diff --quiet origin/release HEAD && (echo   ^(none - server is already up to date^) & goto done)
)

echo.
choice /c YN /m "Deploy to the server now"
if errorlevel 2 goto done

git push origin main main:release || (echo [!] Push failed. & goto fail)
echo.
echo Deployed. The server will update within about 1 minute.
goto done

:fail
echo.
pause
exit /b 1

:done
echo.
pause
