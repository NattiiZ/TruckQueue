# Install autostart tasks (boot, no login needed). Run as Administrator.
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force (Join-Path $root 'logs') | Out-Null

function Add-Task($name, $exe, $arguments, $workdir, $delaySec, $trigger, $principal) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  if ($arguments) { $action = New-ScheduledTaskAction -Execute $exe -Argument $arguments -WorkingDirectory $workdir }
  else            { $action = New-ScheduledTaskAction -Execute $exe -WorkingDirectory $workdir }
  $trigger.Delay = 'PT' + $delaySec + 'S'
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
  Write-Host ('Installed ' + $name)
}

$sys = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$cmd = $env:SystemRoot + '\System32\cmd.exe'
Add-Task 'TruckQueue-MySQL'   'C:\xampp\mysql\bin\mysqld.exe' '--defaults-file=C:\xampp\mysql\bin\my.ini --standalone' 'C:\xampp' 0 (New-ScheduledTaskTrigger -AtStartup) $sys
Add-Task 'TruckQueue-Apache'  'C:\xampp\apache\bin\httpd.exe' '' 'C:\xampp\apache\bin' 0 (New-ScheduledTaskTrigger -AtStartup) $sys
Add-Task 'TruckQueue-Backend' $cmd ('/c "' + $PSScriptRoot + '\run-backend.bat"') $root 20 (New-ScheduledTaskTrigger -AtStartup) $sys
Add-Task 'TruckQueue-Tunnel'  $cmd ('/c "' + $PSScriptRoot + '\run-tunnel.bat"') $root 30 (New-ScheduledTaskTrigger -AtStartup) $sys

# On login (incl. remote): close background backend/tunnel and reopen them in visible windows
$me = New-ScheduledTaskPrincipal -UserId 'natt' -LogonType Interactive -RunLevel Highest
$showArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $PSScriptRoot + '\run-visible.ps1"'
Add-Task 'TruckQueue-ShowOnLogin' 'powershell.exe' $showArgs $root 60 (New-ScheduledTaskTrigger -AtLogOn -User 'natt') $me

Write-Host ''
Write-Host 'Done. Starting boot tasks now...'
'TruckQueue-MySQL','TruckQueue-Apache' | ForEach-Object { if (-not (Get-Process -Name mysqld,httpd -ErrorAction SilentlyContinue)) { Start-ScheduledTask -TaskName $_ } }
Start-ScheduledTask -TaskName 'TruckQueue-Backend'
Start-ScheduledTask -TaskName 'TruckQueue-Tunnel'
