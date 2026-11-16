// Terminals for the phone: a shell in a pseudo console (agent/win-agent.ps1 -Mode pty), one
// process per terminal. A terminal outlives the phone's connection (the phone going to the
// home screen, a network change): coming back attaches to it again and replays what it
// printed meanwhile. One left alone for two hours is closed.
import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const SCRIPT = fileURLToPath(new URL('../agent/win-agent.ps1', import.meta.url));
const KEEP = 256 * 1024; // output kept for a phone that comes back
const IDLE = 2 * 60 * 60 * 1000;

const frame = (type, payload) => {
	const head = Buffer.alloc(5);
	head[0] = type;
	head.writeInt32LE(payload.length, 1);
	return Buffer.concat([head, payload]);
};
const sizeFrame = (cols, rows) => {
	const b = Buffer.alloc(4);
	b.writeUInt16LE(Math.max(10, Math.min(500, cols | 0)), 0);
	b.writeUInt16LE(Math.max(4, Math.min(300, rows | 0)), 2);
	return frame(1, b);
};

const where = async (name) => {
	try {
		const { stdout } = await run('where.exe', [name], { windowsHide: true, timeout: 5000 });
		return stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	} catch {
		return [];
	}
};
/** Runs `exe --version`: the Microsoft Store's stand-in python.exe answers no version. */
const answers = async (exe, args = ['--version']) => {
	try {
		const { stdout, stderr } = await run(exe, args, { windowsHide: true, timeout: 5000, encoding: 'utf8' });
		return /\d+\.\d+/.test(stdout + stderr) ? (stdout + stderr).trim().split(/\r?\n/)[0] : null;
	} catch {
		return null;
	}
};
const q = (p) => `"${p}"`;

/**
 * The shells installed on this PC, as { id, name, version, command }. The phone picks one
 * by id; the command line is only ever built here.
 */
async function findShells() {
	const shells = [{ id: 'powershell', name: 'Windows PowerShell', command: 'powershell.exe -NoLogo' }];
	const [pwsh] = await where('pwsh');
	if (pwsh) shells.push({ id: 'pwsh', name: 'PowerShell 7', version: await answers(pwsh), command: `${q(pwsh)} -NoLogo` });
	shells.push({ id: 'cmd', name: 'Command Prompt', command: 'cmd.exe' });
	const gitBash = [
		join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
		join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
		...(await where('git')).map((g) => join(dirname(dirname(g)), 'bin', 'bash.exe')),
	].find((p) => p && existsSync(p));
	if (gitBash) shells.push({ id: 'gitbash', name: 'Git Bash', command: `${q(gitBash)} --login -i` });
	// WSL with a Linux of the user's own (Docker's own distributions are not shells).
	try {
		const { stdout } = await run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss', '/s', '/v', 'DistributionName'], { windowsHide: true, timeout: 5000 });
		const distros = [...stdout.matchAll(/DistributionName\s+REG_SZ\s+(.+)/g)].map((m) => m[1].trim()).filter((d) => !/^docker-desktop/i.test(d));
		if (distros.length && existsSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe'))) shells.push({ id: 'wsl', name: `WSL (${distros[0]})`, command: 'wsl.exe --cd ~' });
	} catch {}
	// Python: the py launcher, else a python.exe that really is one.
	const [py] = await where('py');
	const pyVersion = py && (await answers(py));
	if (pyVersion) shells.push({ id: 'python', name: 'Python', version: pyVersion, command: q(py) });
	else
		for (const p of await where('python')) {
			const v = await answers(p);
			if (v) {
				shells.push({ id: 'python', name: 'Python', version: v, command: q(p) });
				break;
			}
		}
	const node = process.execPath;
	shells.push({ id: 'node', name: 'Node.js', version: process.version, command: q(node) });
	return shells;
}

export function createTerminals({ cacheDir, log }) {
	const sessions = new Map(); // id → { child, shell, buf: Buffer[], size, ws, idle, ended, at }
	let shells = null;
	let shellsAt = 0;
	const listShells = async () => {
		if (!shells || Date.now() - shellsAt > 60_000) {
			shells = await findShells();
			shellsAt = Date.now();
		}
		return shells;
	};

	function start(cols, rows, shell) {
		const id = crypto.randomBytes(9).toString('base64url');
		const child = spawn(
			'powershell.exe',
			['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Mode', 'pty', '-Cache', cacheDir, '-Cols', String(cols), '-Rows', String(rows), '-Shell', shell.command, '-Dir', os.homedir()],
			{ windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
		);
		const s = { id, child, shell, buf: [], size: 0, ws: null, idle: null, ended: false, at: Date.now() };
		child.stdout.on('data', (d) => {
			s.buf.push(d);
			s.size += d.length;
			while (s.size > KEEP && s.buf.length > 1) s.size -= s.buf.shift().length;
			if (s.ws?.open) s.ws.sendBinary(d);
		});
		child.stderr.on('data', (d) => log(`terminal: ${String(d).trim().slice(0, 300)}`));
		child.on('exit', () => {
			s.ended = true;
			sessions.delete(id);
			clearTimeout(s.idle);
			if (s.ws?.open) {
				s.ws.sendText({ t: 'exit' });
				s.ws.close();
			}
		});
		child.stdin.on('error', () => {});
		sessions.set(id, s);
		return s;
	}

	/**
	 * The terminal's WebSocket: ?id=… attaches to a running one; else a new one starts with
	 * ?shell=… (an id from shells()), Windows PowerShell by default.
	 */
	async function attach(ws, query) {
		const cols = Number(query.get('cols')) || 80;
		const rows = Number(query.get('rows')) || 24;
		let s = sessions.get(query.get('id') || '');
		const resumed = !!s;
		if (s) {
			s.ws?.open && s.ws.close(); // one phone at a time on a terminal
			s.child.stdin.write(sizeFrame(cols, rows));
		} else {
			const all = await listShells();
			s = start(cols, rows, all.find((x) => x.id === query.get('shell')) || all[0]);
		}
		clearTimeout(s.idle);
		s.ws = ws;
		ws.sendText({ t: 'ready', id: s.id, resumed, shell: { id: s.shell.id, name: s.shell.name } });
		if (resumed && s.size) ws.sendBinary(Buffer.concat(s.buf));
		ws.on('binary', (data) => !s.ended && s.child.stdin.write(frame(0, data)));
		ws.on('message', (text) => {
			let m;
			try {
				m = JSON.parse(text);
			} catch {
				return;
			}
			if (m.t === 'resize') s.child.stdin.write(sizeFrame(m.cols, m.rows));
			else if (m.t === 'input') s.child.stdin.write(frame(0, Buffer.from(String(m.s ?? ''), 'utf8')));
			else if (m.t === 'kill') s.child.kill();
		});
		ws.on('close', () => {
			if (s.ws !== ws) return;
			s.ws = null;
			s.idle = setTimeout(() => s.child.kill(), IDLE);
		});
	}

	return {
		attach,
		/** Installed shells and the terminals running now, for the phone's picker. */
		async list() {
			return {
				shells: (await listShells()).map(({ id, name, version }) => ({ id, name, version: version || null })),
				running: [...sessions.values()].map((s) => ({ id: s.id, shell: s.shell.id, name: s.shell.name, at: s.at })),
			};
		},
		stopAll() {
			for (const s of sessions.values()) s.child.kill();
		},
	};
}
