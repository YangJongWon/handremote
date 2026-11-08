// What runs on the PC as servers: listening TCP ports with their processes, and which of
// them answer HTTP with a page (the "web apps" a phone can open through the forwarder).
import { execFile } from 'node:child_process';
import http from 'node:http';

const run = (cmd, args) =>
	new Promise((resolve) => {
		execFile(cmd, args, { windowsHide: true, maxBuffer: 8 << 20, timeout: 8000 }, (err, stdout) => resolve(err ? '' : stdout));
	});

// Windows' own listeners: not what anyone means by "my servers".
const SYSTEM_PROCS = new Set(['system', 'svchost', 'lsass', 'wininit', 'services', 'spoolsv', 'idle', 'smss', 'csrss', 'winlogon', 'searchindexer', 'msmpeng', 'nissrv']);

async function listeners() {
	const out = await run('netstat', ['-ano', '-p', 'TCP']);
	const out6 = await run('netstat', ['-ano', '-p', 'TCPv6']);
	const found = new Map(); // port → { port, pid, local }
	for (const line of `${out}\n${out6}`.split(/\r?\n/)) {
		const m = /^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)/i.exec(line);
		if (!m) continue;
		const [, addr, portText, pidText] = m;
		const port = Number(portText);
		const pid = Number(pidText);
		const local = /^(127\.|\[::1\])/.test(addr);
		const prev = found.get(port);
		if (!prev) found.set(port, { port, pid, local });
		else if (!local) prev.local = false;
	}
	return [...found.values()];
}

// Names of the listening processes, from the agent (tasklist takes over a second).
async function processNames(pids, agent) {
	const names = new Map([[0, 'Idle'], [4, 'System']]);
	try {
		const r = await agent.request('names', { pids: pids.filter((p) => p > 4) });
		for (const [pid, name] of Object.entries(r.names)) names.set(Number(pid), name);
	} catch {}
	return names;
}

/** Whether 127.0.0.1:port answers HTTP with an HTML page, quickly. */
function servesPage(port) {
	return new Promise((resolve) => {
		const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 600, headers: { accept: 'text/html' } }, (res) => {
			const type = String(res.headers['content-type'] || '');
			res.resume();
			resolve(/text\/html/.test(type) || (res.statusCode >= 300 && res.statusCode < 400) ? { status: res.statusCode, type } : null);
		});
		req.on('timeout', () => req.destroy());
		req.on('error', () => resolve(null));
	});
}

const probeCache = new Map(); // `${port}:${pid}` → { at, page }

/**
 * { servers: [{ pid, name, ports: [{ port, local, web }] }] } for the user's own servers,
 * busiest first; `web` marks a port that serves a page.
 */
export async function serverStatus({ ownPorts = [], agent }) {
	const ports = await listeners();
	const names = await processNames([...new Set(ports.map((p) => p.pid))], agent);
	const byPid = new Map();
	await Promise.all(
		ports.map(async (p) => {
			const name = names.get(p.pid) || `pid ${p.pid}`;
			if (p.pid <= 4 || SYSTEM_PROCS.has(name.toLowerCase()) || ownPorts.includes(p.port)) return;
			if (p.port >= 49152 && !p.local) return; // dynamic ports of RPC-style services
			const key = `${p.port}:${p.pid}`;
			let hit = probeCache.get(key);
			if (!hit || Date.now() - hit.at > 30000) {
				hit = { at: Date.now(), page: p.port < 49152 || p.local ? await servesPage(p.port) : null };
				probeCache.set(key, hit);
			}
			if (!byPid.has(p.pid)) byPid.set(p.pid, { pid: p.pid, name, ports: [] });
			byPid.get(p.pid).ports.push({ port: p.port, local: p.local, web: !!hit.page });
		}),
	);
	const servers = [...byPid.values()];
	for (const s of servers) s.ports.sort((a, b) => a.port - b.port);
	servers.sort((a, b) => Number(b.ports.some((p) => p.web)) - Number(a.ports.some((p) => p.web)) || a.name.localeCompare(b.name));
	return { servers };
}
