# Stop background backend + tunnel, then run them in visible terminal windows.
Stop-ScheduledTask -TaskName 'TruckQueue-Backend' -ErrorAction SilentlyContinue
Stop-ScheduledTask -TaskName 'TruckQueue-Tunnel' -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'src/server.js') -or $_.Name -eq 'cloudflared.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
$root = Split-Path $PSScriptRoot -Parent
$bd = Join-Path $root 'backend'
$be = '/k title TruckQueue Backend && cd /d "' + $bd + '" && npm start'
Start-Process cmd.exe -ArgumentList $be -WorkingDirectory $bd
$tunnel = ''
Get-Content (Join-Path $bd '.env') | ForEach-Object { if ($_ -match '^\s*TUNNEL_NAME\s*=\s*(.+)$') { $tunnel = $Matches[1].Trim() } }
if ($tunnel) {
  Start-Sleep -Seconds 4
  $tn = '/k title TruckQueue Tunnel && cloudflared tunnel run ' + $tunnel
  Start-Process cmd.exe -ArgumentList $tn -WorkingDirectory $root
}
