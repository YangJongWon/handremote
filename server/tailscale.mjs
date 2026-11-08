// Away from home, standalone: "tailscale serve" publishes handremote to the devices signed in
// to the user's tailnet only, at https://<machine>.<tailnet>.ts.net:<port> with a real
// certificate. Port 443 is left to handide (one PC, one 443); handremote takes its own port.
// Never Funnel: the SYSTEM helper can reach the lock screen, so handremote stays private.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CANDIDATES = {
	win32: ['C:\\Program Files\\Tailscale\\tailscale.exe', 'C:\\Program Files (x86)\\Tailscale\\tailscale.exe'],
	darwin: ['/Applications/Tailscale.app/Contents/MacOS/Tailscale', '/usr/local/bin/tailscale', '/opt/homebrew/bin/tailscale'],
};
const CLI_ENV = { ...process.env, TAILSCALE_BE_CLI: '1' };

function run(cli, args, timeout = 15000) {
	return new Promise((resolve) => {
		let out = '';
		let child;
		try {
			child = spawn(cli, args, { windowsHide: true, env: CLI_ENV });
		} catch (err) {
			return resolve({ code: -1, out: err.message });
		}
		const timer = setTimeout(() => {
			child.kill();
			resolve({ code: null, out, timedOut: true });
		}, timeout);
		child.stdout.on('data', (d) => (out += d));
		child.stderr.on('data', (d) => (out += d));
		child.on('error', (err) => (clearTimeout(timer), resolve({ code: -1, out: err.message })));
		child.on('close', (code) => (clearTimeout(timer), resolve({ code, out })));
	});
}

async function findCli() {
	for (const p of CANDIDATES[process.platform] || []) if (existsSync(p)) return p;
	return (await run('tailscale', ['version'], 5000)).code === 0 ? 'tailscale' : null;
}

/** Resolves to { url, stop } or { reason }. */
export async function startTailscale({ port, httpsPort, tls, log }) {
	const cli = await findCli();
	if (!cli) return { reason: 'Tailscale is not installed' };
	let status;
	try {
		status = JSON.parse((await run(cli, ['status', '--json'])).out);
	} catch {
		return { reason: 'Tailscale did not answer' };
	}
	const dnsName = status.Self?.DNSName?.replace(/\.$/, '');
	if (status.BackendState !== 'Running' || !dnsName) return { reason: `Tailscale is ${status.BackendState || 'not running'}` };
	const target = `${tls ? 'https+insecure' : 'http'}://127.0.0.1:${port}`;
	const res = await run(cli, ['serve', '--bg', '--yes', `--https=${httpsPort}`, target], 60000);
	if (res.code !== 0) {
		log(`tailscale serve: ${res.out.trim().split('\n').slice(-2).join(' ')}`);
		return { reason: res.timedOut ? 'tailscale serve timed out (allow HTTPS for your tailnet once: run "handide remote" or the Tailscale admin page)' : 'tailscale serve failed' };
	}
	return {
		url: `https://${dnsName}:${httpsPort}`,
		stop: () => spawnSync(cli, ['serve', `--https=${httpsPort}`, 'off'], { windowsHide: true, timeout: 5000, env: CLI_ENV }),
	};
}
