@echo off
rem Restart TruckQueue in visible terminal windows (stops the background copy first). Asks for admin once.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"C:\Users\natt\Desktop\TruckQueue\_server\scripts\run-visible.ps1\"'"
