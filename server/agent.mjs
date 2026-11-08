// The user's agent (agent/win-agent.ps1 → Agent.cs) as a promise API. Requests go one at a
// time per agent process; handremote runs two, so a frame being captured never holds up a
// tap: `frames` for capture, `control` for everything else.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import net from 'node:net';
import readline from 'node:readline';

const SCRIPT = fileURLToPath(new URL('../agent/win-agent.ps1', import.meta.url));

/** JSON with every non-ASCII character escaped: the agent reads its pipe as UTF-8 either way. */
const asciiJson = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

class Lines {
	constructor(name, log) {
		this.name = name;
		this.log = log;
		this.seq = 0;
		this.pending = new Map();
		this.queue = [];
		this.busy = false;
	}

	attach(input, output, onEnd) {
		this.output = output;
		const rl = readline.createInterface({ input });
		rl.on('line', (line) => {
			let res;
			try {
				res = JSON.parse(line);
			} catch {
				return this.log(`${this.name}: ${line.slice(0, 200)}`);
			}
			const p = this.pending.get(res.id);
			if (!p) return;
			this.pending.delete(res.id);
			clearTimeout(p.timer);
			this.busy = false;
			if (res.ok) p.resolve(res);
			else p.reject(Object.assign(new Error(res.error || 'agent error'), { code: /^([a-z-]+):/.exec(res.error || '')?.[1] }));
			this.pump();
		});
		rl.on('close', () => {
			for (const p of this.pending.values()) p.reject(new Error(`${this.name} stopped`));
			for (const q of this.queue) q.reject(new Error(`${this.name} stopped`));
			this.pending.clear();
			this.queue = [];
			this.busy = false;
			this.output = null;
			onEnd?.();
		});
	}

	get ready() {
		return !!this.output;
	}

	/** Sends a request; `urgent` ones (input) go before queued ones (lists, icons). */
	request(op, args = {}, { timeout = 15000, urgent = false } = {}) {
		return new Promise((resolve, reject) => {
			const job = { op, args, timeout, resolve, reject };
			if (urgent) this.queue.unshift(job);
			else this.queue.push(job);
			this.pump();
		});
	}

	pump() {
		if (this.busy || !this.output || !this.queue.length) return;
		const job = this.queue.shift();
		const id = ++this.seq;
		this.busy = true;
		const timer = setTimeout(() => {
			if (!this.pending.has(id)) return;
			this.pending.delete(id);
			this.busy = false;
			job.reject(new Error(`${this.name}: ${job.op} timed out`));
			this.pump();
		}, job.timeout);
		this.pending.set(id, { ...job, timer });
		this.output.write(asciiJson({ id, op: job.op, ...job.args }) + '\n');
	}
}

/** One user agent process, restarted when it dies. */
function startProcess(name, { cacheDir, log }) {
	const lines = new Lines(name, log);
	let child;
	let stopped = false;
	const start = () => {
		child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Mode', 'stdio', '-Cache', cacheDir, '-ParentPid', String(process.pid)], {
			windowsHide: true,
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		child.stderr.on('data', (d) => log(`${name}: ${String(d).trim().slice(0, 500)}`));
		lines.attach(child.stdout, child.stdin, () => {
			if (stopped) return;
			log(`${name} agent stopped, restarting`);
			setTimeout(start, 1000);
		});
	};
	start();
	return {
		lines,
		stop() {
			stopped = true;
			child?.kill();
		},
	};
}

export function startAgents({ dataDir, log }) {
	const cacheDir = join(dataDir, 'cache');
	const frames = startProcess('frames', { cacheDir, log });
	const control = startProcess('control', { cacheDir, log });
	return {
		frames: frames.lines,
		control: control.lines,
		stop() {
			frames.stop();
			control.stop();
		},
	};
}

/**
 * The SYSTEM helper's agent over its named pipe (agent/helper: Launcher + RunPipe). Connects
 * on demand and again after a drop; `connected` says whether it answers now.
 */
export function helperClient({ pipe = 'handremote-helper', secret, log }) {
	const lines = new Lines('helper', log);
	let connecting = null;
	let info = null;
	const connect = () => {
		if (lines.ready || connecting || !secret()) return connecting;
		connecting = new Promise((resolve) => {
			const sock = net.connect(`\\\\.\\pipe\\${pipe}`);
			const fail = () => {
				connecting = null;
				resolve(false);
			};
			sock.once('error', fail);
			sock.once('connect', () => {
				sock.removeListener('error', fail);
				sock.on('error', () => {});
				const rl = readline.createInterface({ input: sock });
				rl.once('line', (first) => {
					rl.close();
					let ok = false;
					try {
						ok = JSON.parse(first).ok === true;
					} catch {}
					if (!ok) {
						log('helper: the pipe refused the secret');
						sock.destroy();
						return fail();
					}
					lines.attach(sock, sock, () => {
						info = null;
					});
					lines.request('hello').then((h) => (info = h)).catch(() => {});
					connecting = null;
					resolve(true);
				});
				sock.write(asciiJson({ secret: secret() }) + '\n');
			});
		});
		return connecting;
	};
	return {
		get connected() {
			return lines.ready;
		},
		get info() {
			return info;
		},
		connect,
		async request(op, args, opts) {
			if (!lines.ready) await connect();
			if (!lines.ready) throw Object.assign(new Error('helper not running'), { code: 'no-helper' });
			return lines.request(op, args, opts);
		},
	};
}
