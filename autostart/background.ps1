# Close visible terminals and return backend + tunnel to background mode.
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'TruckQueue (Backend|Tunnel)' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'src/server.js') -or $_.Name -eq 'cloudflared.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName 'TruckQueue-Backend'
Start-ScheduledTask -TaskName 'TruckQueue-Tunnel'
Write-Host 'Back to background mode.'
