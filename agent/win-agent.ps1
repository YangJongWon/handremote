# Hosts agent/Agent.cs (C# 5, compiled once per version into -Cache) in Windows PowerShell 5.1.
#   -Mode stdio     the user's agent for the handremote server (JSON lines on stdin/stdout)
#   -Mode pipe      the SYSTEM helper's agent in the console session (named pipe)
#   -Mode launcher  the SYSTEM startup task in session 0 that keeps the pipe agent running
param(
	[ValidateSet('stdio', 'pipe', 'launcher')] [string]$Mode = 'stdio',
	[string]$Cache = (Join-Path $env:TEMP 'handremote'),
	[int]$ParentPid = 0,
	[string]$Pipe = 'handremote-helper',
	[string]$Secret = '',
	[string]$UserSid = '',
	[string]$Log = ''
)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'Agent.cs'
$code = [IO.File]::ReadAllText($source)
$sha = [Security.Cryptography.SHA256]::Create()
$hash = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($code)) | Select-Object -First 8 | ForEach-Object { $_.ToString('x2') })
New-Item -ItemType Directory -Force $Cache | Out-Null
$dll = Join-Path $Cache "handremote-agent-$hash.dll"
$refs = @('System.Drawing', 'System.Web.Extensions', 'System.Management', 'System.Core', 'UIAutomationClient', 'UIAutomationTypes', 'WindowsBase')
# handremote starts two agents at once: one compiles, the other waits and loads the result.
$mutex = New-Object Threading.Mutex($false, "Local\handremote-agent-$hash")
[void]$mutex.WaitOne(120000)
try {
	if (-not (Test-Path $dll)) {
		$tmp = "$dll.$PID.tmp"
		Add-Type -TypeDefinition $code -ReferencedAssemblies $refs -OutputAssembly $tmp -OutputType Library
		Move-Item -Force $tmp $dll
	}
}
finally { $mutex.ReleaseMutex() }
foreach ($r in $refs) { [void][Reflection.Assembly]::LoadWithPartialName($r) }
Add-Type -Path $dll

switch ($Mode) {
	'stdio' { [HandRemote.Agent]::RunStdio($ParentPid) }
	'pipe' { [HandRemote.Agent]::RunPipe($Pipe, $Secret, $UserSid) }
	'launcher' {
		$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
		$cmd = "`"$ps`" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Mode pipe -Cache `"$Cache`" -Pipe $Pipe -Secret `"$Secret`" -UserSid $UserSid"
		[HandRemote.Launcher]::Run($cmd, $Log)
	}
}
