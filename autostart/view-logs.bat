@echo off
start "Backend log" powershell -NoProfile -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Content '%~dp0..\logs\server.log' -Tail 30 -Wait -Encoding UTF8"
start "Tunnel log" powershell -NoProfile -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Content '%~dp0..\logs\tunnel.log' -Tail 30 -Wait -Encoding UTF8"
