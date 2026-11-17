// "handremote service": runs handremote at logon and starts it again whenever it exits (a
// crash, an update, a stuck agent), so the phone finds the PC without anyone at it. A
// hidden script in the Startup folder loops; no administrator rights, no window. Same
// pattern as handide's service (handide/proxy/service.mjs).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WAIT_MS = 5_000; // before starting again
const WAIT_FAST_EXIT_MS = 60_000; // after a run shorter than a minute, so a broken start does not spin
const BIN = fileURLToPath(new URL('../bin/handremote.mjs', import.meta.url));
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const startupScript = () => join(process.env.APPDATA ?? join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'handremote.vbs');
const run = (cmd, args) => spawnSync(cmd, args, { windowsHide: true, encoding: 'utf8' });

/** Started by the Startup script (it sets HANDREMOTE_SERVICE=1). */
export const underService = () => process.env.HANDREMOTE_SERVICE === '1';

function windowsScript({ args, dataDir }) {
	const q = (s) => `""${s}""`;
	const log = join(dataDir, 'handremote.log');
	const err = join(dataDir, 'handremote.err.log');
	const command = [process.execPath, BIN, ...args];
	const cmd = `cmd.exe /c cd /d ${q(ROOT)} && set HANDREMOTE_SERVICE=1&& echo [%date% %time%] handremote start >> ${q(err)} && ${command.map(q).join(' ')} > ${q(log)} 2>> ${q(err)}`;
	return `' handremote service ("handremote service install"): the PC's windows on the phone, started
' at logon and again whenever it exits: after ${WAIT_MS / 1000} seconds, or after ${WAIT_FAST_EXIT_MS / 1000} if it ran for less
' than a minute. "handremote service uninstall" stops it and removes this file.
' Log: ${log} (current run)
'      ${err} (all runs, with start times)
Dim sh, started
Set sh = CreateObject("Wscript.Shell")
Do
	started = Timer
	sh.Run "${cmd}", 0, True
	If Abs(Timer - started) < 60 Then WScript.Sleep ${WAIT_FAST_EXIT_MS} Else WScript.Sleep ${WAIT_MS}
Loop
`;
}

/** Process ids of the Startup script's loop. */
function loops() {
	const r = run('powershell.exe', [
		'-NoProfile',
		'-Command',
		"Get-CimInstance Win32_Process -Filter \"Name='wscript.exe'\" | Where-Object { $_.CommandLine -match 'handremote\\.vbs' } | ForEach-Object { $_.ProcessId }",
	]);
	return (r.stdout || '').split(/\s+/).filter(Boolean);
}

/** Ends the loop and everything under it. */
function stopLoops() {
	const pids = loops();
	for (const pid of pids) run('taskkill', ['/pid', pid, '/T', '/F']);
	return pids.length;
}

/** A handremote started by hand (its endpoint.json names it): it would hold the port. */
function stopManual(dataDir) {
	try {
		const { pid } = JSON.parse(readFileSync(join(dataDir, 'endpoint.json'), 'utf8'));
		if (pid && pid !== process.pid && run('taskkill', ['/pid', String(pid), '/T', '/F']).status === 0) return true;
	} catch {}
	return false;
}

export function serviceState() {
	if (process.platform !== 'win32') return { supported: false };
	return { supported: true, installed: existsSync(startupScript()), running: underService() };
}

/**
 * Writes the Startup script. `start`: run its loop now too (from the command line, after
 * stopping what holds the port; from the phone, the running server hands over by exiting).
 */
export async function installService({ args = [], dataDir, log, start = true, takeOver = true }) {
	if (process.platform !== 'win32') throw new Error('handremote service is for Windows for now');
	if ([process.execPath, BIN, ...args].some((a) => a.includes('"'))) throw new Error('a path or option with a quote (") cannot go in the Startup script');
	await mkdir(dataDir, { recursive: true });
	const file = startupScript();
	const stopped = start ? stopLoops() : 0;
	const manual = start && takeOver ? stopManual(dataDir) : false;
	await writeFile(file, windowsScript({ args, dataDir }));
	if (start) spawn('wscript.exe', [file], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
	log(`${stopped || manual ? 'restarted' : start ? 'started' : 'installed'}; runs at logon from ${file}`);
	log(`log: ${join(dataDir, 'handremote.log')}`);
}

/** Removes the Startup script; `stop` ends the loop too (not from inside it). */
export async function uninstallService({ log, stop = true }) {
	const stopped = stop ? stopLoops() : 0;
	await rm(startupScript(), { force: true });
	log(stopped ? 'stopped and removed' : 'removed');
}

export function serviceStatus() {
	if (process.platform !== 'win32') return 'not supported here (Windows only for now)';
	const file = startupScript();
	if (!existsSync(file)) return 'not installed ("handremote service install" sets it up)';
	return `installed (${file}); ${loops().length ? 'running' : 'not running: log off and on, or run "handremote service install" again'}`;
}

/**
 * Starts the loop in a few seconds if none runs: the phone turned it on while handremote
 * ran by hand, and this one exits meanwhile so the loop's handremote gets the port.
 */
export function startLoopSoon(seconds = 3) {
	if (loops().length) return false;
	spawn('cmd.exe', ['/c', `ping -n ${seconds + 1} 127.0.0.1 >nul & wscript.exe "${startupScript()}"`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
	return true;
}
