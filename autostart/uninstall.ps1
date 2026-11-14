'MySQL','Apache','Backend','Tunnel','ShowOnLogin' | ForEach-Object { Unregister-ScheduledTask -TaskName ('TruckQueue-' + $_) -Confirm:$false -ErrorAction SilentlyContinue }
Write-Host 'Removed.'
