// Proof of life for the service's watchdog (service.mjs): every 20 seconds this process asks
// its own health address, and only when that answers does it touch <dataDir>/heartbeat. A
// process that is alive but stuck (a blocked event loop, a server that stopped answering)
// stops touching it, and the Startup script ends it and starts it again.
// handide has the same file (handide/proxy/heartbeat.mjs).
import http from 'node:http';
import https from 'node:https';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const HEARTBEAT_FILE = 'heartbeat';
export const HEARTBEAT_MS = 20_000;

export function startHeartbeat({ dataDir, url }) {
	const file = join(dataDir, HEARTBEAT_FILE);
	const beat = () => {
		const req = (url.startsWith('https:') ? https : http).get(url, { rejectUnauthorized: false, agent: false, timeout: 10_000 }, (res) => {
			res.resume();
			if (res.statusCode < 500) writeFile(file, `${new Date().toISOString()}\n`).catch(() => {});
		});
		req.on('timeout', () => req.destroy());
		req.on('error', () => {});
	};
	beat();
	const timer = setInterval(beat, HEARTBEAT_MS);
	timer.unref();
	return () => clearInterval(timer);
}
