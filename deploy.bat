@echo off
rem TruckQueue deploy (optional helper, DEV machine): shows what will go live, asks, then pushes main.
rem The server (auto-update.bat) uses the latest push to GitHub "main" within ~1 minute,
rem so a normal "git push" / GitHub Desktop "Push origin" does exactly the same thing.
rem Commits that are not pushed never reach the server.
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
  echo [!] Note: there are uncommitted changes. They will NOT be deployed:
  git status --short
  echo.
)

echo Checking GitHub...
git fetch -q origin || (echo [!] Cannot reach GitHub. & goto fail)
git merge-base --is-ancestor origin/main HEAD || (
  echo [!] GitHub main has commits this machine does not have. Run "git pull" first.
  goto fail
)
git diff --quiet origin/main HEAD && (
  echo Nothing new to deploy - the server already has your latest pushed commit.
  goto done
)

echo.
echo Commits that will go to the server:
git log --oneline origin/main..HEAD
echo.
choice /c YN /m "Push and deploy now"
if errorlevel 2 goto done

git push origin main || (echo [!] Push failed. & goto fail)
echo.
echo Pushed. The server will update within about 1 minute.
goto done

:fail
echo.
pause
exit /b 1

:done
echo.
pause
