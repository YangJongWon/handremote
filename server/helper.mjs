// The SYSTEM helper: installed (once, through UAC) into %ProgramData%\handremote as a startup
// task that keeps an agent running in the console session with the SYSTEM token. It reaches
// what the user's agent cannot: elevated windows, UAC prompts, the lock and sign-in screens.
// handremote talks to it over a named pipe only SYSTEM and the installing user may open,
// after showing the secret in helper-secret (readable by that user only).
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HELPER_PIPE = 'handremote-helper';
export const PROGRAM_DIR = join(process.env.ProgramData || 'C:\\ProgramData', 'handremote');
const SETUP = fileURLToPath(new URL('../agent/helper-setup.ps1', import.meta.url));
const AGENT_DIR = fileURLToPath(new URL('../agent/', import.meta.url));

export const helperInstalled = () => process.platform === 'win32' && existsSync(join(PROGRAM_DIR, 'helper.json'));

export function readHelperSecret() {
	try {
		return readFileSync(join(PROGRAM_DIR, 'helper-secret'), 'utf8').trim();
	} catch {
		return null;
	}
}

const run = (cmd, args) =>
	new Promise((resolve) => execFile(cmd, args, { windowsHide: true, timeout: 600000 }, (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, out: `${stdout}${stderr}` })));

async function currentUserSid() {
	// The Windows whoami by full path: Git for Windows puts a GNU whoami earlier on PATH.
	const r = await run(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'whoami.exe'), ['/user', '/fo', 'csv', '/nh']);
	return /"(S-1-5-21-[\d-]+)"/.exec(r.out)?.[1] || null;
}

/** Runs helper-setup.ps1 elevated (one UAC prompt) and waits for it. */
async function elevated(action, extra = []) {
	const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SETUP, '-Action', action, '-Source', AGENT_DIR.replace(/[\\/]$/, ''), ...extra];
	const quoted = args.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(',');
	const script = `$p = Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList ${quoted}; exit $p.ExitCode`;
	return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

const pipeAnswers = () =>
	new Promise((resolve) => {
		const s = net.connect(`\\\\.\\pipe\\${HELPER_PIPE}`);
		s.once('connect', () => (s.destroy(), resolve(true)));
		s.once('error', () => resolve(false));
	});

export async function helperStatus() {
	if (process.platform !== 'win32') return { supported: false };
	const installed = helperInstalled();
	let info = null;
	try {
		info = JSON.parse(readFileSync(join(PROGRAM_DIR, 'helper.json'), 'utf8').replace(/^\uFEFF/, ''));
	} catch {}
	return { supported: true, installed, secretReadable: !!readHelperSecret(), running: installed && (await pipeAnswers()), info };
}

export async function installHelper({ version, log }) {
	if (process.platform !== 'win32') throw new Error('the SYSTEM helper is for Windows');
	const sid = await currentUserSid();
	if (!sid) throw new Error('could not read this user account (whoami /user)');
	log('Windows will ask for administrator approval (UAC) once.');
	const r = await elevated('install', ['-UserSid', sid, '-Version', version]);
	if (r.code !== 0) throw new Error(`setup did not finish (${/canceled|취소/i.test(r.out) ? 'approval declined' : `exit ${r.code}`}); see %TEMP%\\handremote\\helper-setup.log`);
	for (let i = 0; i < 40 && !(await pipeAnswers()); i++) await new Promise((res) => setTimeout(res, 500));
	return helperStatus();
}

export async function uninstallHelper({ log }) {
	log('Windows will ask for administrator approval (UAC) once.');
	const r = await elevated('uninstall');
	if (r.code !== 0) throw new Error(`removal did not finish (exit ${r.code})`);
	return helperStatus();
}

