# Installs or removes the SYSTEM helper. Runs elevated (handremote helper install|uninstall
# starts it through UAC). The helper runs only files copied here, into a folder that only
# SYSTEM and Administrators can change: a SYSTEM task must never run files the user (or
# anything running as the user) can edit.
param(
	[Parameter(Mandatory)] [ValidateSet('install', 'uninstall')] [string]$Action,
	[string]$UserSid = '',
	[string]$Source = $PSScriptRoot,
	[string]$Version = ''
)
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:ProgramData 'handremote'
$task = 'handremote helper'
$policyKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$log = Join-Path $dir 'setup.log'

function Stop-Helper {
	Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
	Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like "*$dir*win-agent.ps1*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

try {
	if ($Action -eq 'install') {
		if ($UserSid -notmatch '^S-1-5-21-[\d-]+$') { throw "not a user SID: $UserSid" }
		$previous = $null
		if (Test-Path (Join-Path $dir 'helper.json')) { $previous = (Get-Content (Join-Path $dir 'helper.json') -Raw | ConvertFrom-Json).previousSasPolicy }
		Stop-Helper
		New-Item -ItemType Directory -Force $dir | Out-Null
		# Only SYSTEM and Administrators may change the folder; users may read it.
		& icacls.exe $dir /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
		Copy-Item -Force (Join-Path $Source 'Agent.cs'), (Join-Path $Source 'win-agent.ps1') $dir
		Remove-Item -Recurse -Force (Join-Path $dir 'cache') -ErrorAction SilentlyContinue

		# The secret the handremote server must show on the pipe: readable by the user who installed it only.
		$secretFile = Join-Path $dir 'helper-secret'
		$bytes = New-Object byte[] 32
		[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
		[IO.File]::WriteAllText($secretFile, [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_'))
		& icacls.exe $secretFile /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' "*${UserSid}:R" | Out-Null

		# Ctrl+Alt+Del from software (SendSAS) needs this policy; the old value is kept for uninstall.
		if ($null -eq $previous) {
			$v = (Get-ItemProperty -Path $policyKey -Name SoftwareSASGeneration -ErrorAction SilentlyContinue).SoftwareSASGeneration
			$previous = if ($null -eq $v) { 'absent' } else { [string]$v }
		}
		Set-ItemProperty -Path $policyKey -Name SoftwareSASGeneration -Value 1 -Type DWord

		@{ userSid = $UserSid; version = $Version; installedAt = (Get-Date).ToString('o'); previousSasPolicy = $previous } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $dir 'helper.json')

		$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
		$taskArgs = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$dir\win-agent.ps1`" -Mode launcher -Cache `"$dir\cache`" -Secret `"$secretFile`" -UserSid $UserSid -Log `"$dir\helper.log`""
		$action = New-ScheduledTaskAction -Execute $ps -Argument $taskArgs
		$trigger = New-ScheduledTaskTrigger -AtStartup
		$principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -LogonType ServiceAccount -RunLevel Highest
		$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
		Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
		Start-ScheduledTask -TaskName $task
		"$(Get-Date -Format s) installed for $UserSid" | Add-Content $log
	}
	else {
		Stop-Helper
		Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
		$info = $null
		if (Test-Path (Join-Path $dir 'helper.json')) { $info = Get-Content (Join-Path $dir 'helper.json') -Raw | ConvertFrom-Json }
		if ($info -and $info.previousSasPolicy -eq 'absent') { Remove-ItemProperty -Path $policyKey -Name SoftwareSASGeneration -ErrorAction SilentlyContinue }
		elseif ($info -and $info.previousSasPolicy -ne $null) { Set-ItemProperty -Path $policyKey -Name SoftwareSASGeneration -Value ([int]$info.previousSasPolicy) -Type DWord }
		Start-Sleep -Milliseconds 500
		Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
	}
	exit 0
}
catch {
	$msg = "$(Get-Date -Format s) $Action failed: $($_.Exception.Message)"
	try { New-Item -ItemType Directory -Force (Join-Path $env:TEMP 'handremote') | Out-Null; $msg | Add-Content (Join-Path $env:TEMP 'handremote\helper-setup.log') } catch {}
	exit 1
}
