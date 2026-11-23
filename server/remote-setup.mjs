// Remote setup uses the ordinary signed-in Tailscale CLI. No administrator API.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { appHealth, configuredAppAddress } from './app-address.mjs';

const SETTINGS = 'remote-service.json';
const validPort = value => {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Port must be an integer from 1 to 65535.');
	return port;
};
const validService = value => {
	const name = String(value).replace(/^svc:/, '');
	if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) throw Error('The saved Service name is invalid.');
	return name;
};

export function remoteHelp(app, defaultPort) {
	return `${app} remote setup [options]    set up the normal Tailscale connection
${app} remote status [--json]     inspect this app's connection

  --port <n>          this app's server port (default ${defaultPort})
${app === 'handremote' ? '  --ts-port <n>       Tailscale HTTPS port (default 9443)\n' : '  --public           opt in to a public Funnel link (default: private)\n'}  --data-dir <path>   this app's settings directory
  --plan             show the setup plan without changing anything
  --json             machine-readable output
  --name             optional: also the app-name address https://${app}.<tailnet>.ts.net
                     (a Tailscale Service; three one-time steps in the admin console,
                     no API key. The PC then gets a tag: other PCs are no longer found
                     by themselves)
  --no-name          stop using the app-name address on this PC

The default needs only your ordinary Tailscale login: no API key, host tag or Service
registration. Start ${app} to print its QR and app-labelled Tailscale link.
`;
}

const NAMED_TAG = 'tag:handapps';
const APPS = ['handide', 'handremote'];

/** What to paste into the tailnet policy file once, for both apps (and its console steps). */
export function namedAddressGuide({ app, tag = NAMED_TAG, services = APPS }) {
	const svcs = services.map((name) => `svc:${name}`);
	const policy = `"tagOwners": {
  "${tag}": ["autogroup:admin"]
},
"autoApprovers": {
  "services": {
${svcs.map((s) => `    "${s}": ["${tag}"]`).join(',\n')}
  }
},
"grants": [
  // keep your existing grants; add this one
  { "src": ["autogroup:member"], "dst": [${svcs.map((s) => `"${s}"`).join(', ')}], "ip": ["443"] }
]`;
	return {
		policy,
		steps: [
			`1. Policy: open https://login.tailscale.com/admin/acls/file and merge in the lines below (once per tailnet, covers ${services.join(' and ')}).`,
			`2. Services: open https://console.tailscale.com/admin/services → Advertise → Define a Service: name "${app}", port tcp:443 (once per tailnet, per app).`,
			`3. Tag this PC: https://login.tailscale.com/admin/machines → this PC's ⋯ menu → Edit tags → ${tag} → Save (no new sign-in needed).`,
			`Then run "${app} remote setup --name" again.`,
			...(app === 'handide' ? ['Note: a tagged PC is not owned by your account any more, so handide no longer finds your other PCs by itself (add them with "handide devices add").'] : []),
		],
	};
}

export function parseRemoteArgs(args, { app, defaultPort, dataDir }) {
	const opts = { action: 'setup', port: undefined, httpsPort: undefined, dataDir, public: false, plan: false, json: false, help: false, named: false, unnamed: false };
	const rest = [...args];
	if (['setup', 'status'].includes(rest[0])) opts.action = rest.shift();
	for (let i = 0; i < rest.length; i++) {
		const flag = rest[i];
		if (['--plan', '--json', '--help', '-h'].includes(flag)) { opts[flag === '--plan' ? 'plan' : flag === '--json' ? 'json' : 'help'] = true; continue; }
		if (flag === '--name' || flag === '--no-name') { opts[flag === '--name' ? 'named' : 'unnamed'] = true; continue; }
		if (flag === '--public' && app === 'handide') { opts.public = true; continue; }
		const field = { '--port': 'port', '--data-dir': 'dataDir', ...(app === 'handremote' ? { '--ts-port': 'httpsPort' } : {}) }[flag];
		if (!field) throw Error(`Unknown remote option. Run "${app} remote --help". No extra address registration is needed.`);
		const value = rest[++i];
		if (!value || value.startsWith('--')) throw Error(`Missing value for ${flag}.`);
		opts[field] = value;
	}
	if (opts.named && opts.unnamed) throw Error('Use --name or --no-name, not both.');
	if (opts.port !== undefined) opts.port = validPort(opts.port);
	if (opts.httpsPort !== undefined) opts.httpsPort = validPort(opts.httpsPort);
	return { ...opts, dataDir: resolve(opts.dataDir), app, defaultPort };
}

export async function readRemoteSettings(dataDir, app) {
	let saved;
	try { saved = JSON.parse(await readFile(join(dataDir, SETTINGS), 'utf8')); }
	catch (error) { if (error.code === 'ENOENT') return null; throw Error(`Cannot read ${app} remote settings.`); }
	if (saved.app !== app || ![1, 2].includes(saved.version)) throw Error(`Remote settings do not belong to ${app}.`);
	return { version: saved.version, app, port: validPort(saved.port), ...(saved.name ? { name: validService(saved.name) } : {}), ...(saved.httpsPort ? { httpsPort: validPort(saved.httpsPort) } : {}), mode: saved.mode === 'public' ? 'public' : 'private' };
}

async function execute(cli, args, { timeout = 15000, onOutput } = {}) {
	return new Promise(resolvePromise => {
		let output = '';
		const child = spawn(cli, args, { windowsHide: true, env: { ...process.env, TAILSCALE_BE_CLI: '1' } });
		const timer = setTimeout(() => { child.kill(); resolvePromise({ code: -1, output }); }, timeout);
		const collect = chunk => { output += chunk; onOutput?.(String(chunk)); };
		child.stdout.on('data', collect);
		child.stderr.on('data', collect);
		child.on('error', () => { clearTimeout(timer); resolvePromise({ code: -1, output: '' }); });
		child.on('close', code => { clearTimeout(timer); resolvePromise({ code, output }); });
	});
}

function defaultCli() {
	for (const path of ['C:/Program Files/Tailscale/tailscale.exe', 'C:/Program Files (x86)/Tailscale/tailscale.exe', '/Applications/Tailscale.app/Contents/MacOS/Tailscale']) if (existsSync(path)) return path;
	return 'tailscale';
}

export async function runRemoteSetup({ app, defaultPort, dataDir, args, log = console.log, prepare, publish }, deps = {}) {
	const opts = parseRemoteArgs(args, { app, defaultPort, dataDir });
	if (opts.help) { log(remoteHelp(app, defaultPort)); return { help: true }; }
	const saved = await readRemoteSettings(opts.dataDir, app);
	const port = opts.port || saved?.port || defaultPort;
	const httpsPort = app === 'handide' ? 443 : opts.httpsPort || saved?.httpsPort || 9443;
	const service = (deps.env || process.env)[`${app.toUpperCase()}_TAILSCALE_SERVICE`] || saved?.name || app;
	const run = (args, options) => (deps.run || execute)(deps.cli || defaultCli(), args, options);
	const commandJson = async args => {
		const response = await run(args);
		if (response.code !== 0) throw Error('Cannot read Tailscale. Install it and sign in with "tailscale up".');
		try { return JSON.parse(response.output); } catch { throw Error('Tailscale returned an unreadable response.'); }
	};
	const report = value => {
		if (opts.json) log(JSON.stringify(value));
		else { log(`${app} · Tailscale: ${value.url || 'sign-in needed'}\nserver port: ${port}; state: ${value.state}`); for (const action of value.actions || []) log(`  ${action}`); if (value.next) log(value.next); }
		return value;
	};
	if (opts.action === 'setup' && !opts.plan && prepare) await prepare({ ...opts, port, httpsPort });
	let status = await commandJson(['status', '--json']);
	if (status.BackendState !== 'Running' || !status.Self?.DNSName) {
		if (opts.action === 'status' || opts.plan) return report({ app, port, state: 'signed-out', configured: false, url: null });
		const login = await run(['up'], { timeout: 600000, onOutput: message => log(message.trimEnd()) });
		if (login.code !== 0) throw Error('Complete your ordinary Tailscale sign-in, then rerun this command.');
		status = await commandJson(['status', '--json']);
		if (status.BackendState !== 'Running' || !status.Self?.DNSName) throw Error('Tailscale is not signed in yet.');
	}
	const host = status.Self.DNSName.replace(/\.$/, '');
	const url = `https://${host}${httpsPort === 443 ? '' : `:${httpsPort}`}`;
	const routes = await commandJson(['serve', 'status', '--json']);
	const current = routes.Web?.[`${host}:${httpsPort}`]?.Handlers?.['/']?.Proxy;
	const target = `https+insecure://127.0.0.1:${port}`;
	if (opts.action === 'status') {
		const named = await configuredAppAddress({ app, dnsName: host, service, port, tls: true, legacyPort: httpsPort, serveStatus: routes, log: () => {} }, deps.probe);
		let ready = !!named?.named;
		if (!ready && current === target) {
			const probe = deps.probe || appHealth;
			const responses = await Promise.allSettled([probe(`https://127.0.0.1:${port}/__${app}/health`, { local: true }), probe(`${url}/__${app}/health`)]);
			const [local, remote] = responses.map(result => result.status === 'fulfilled' ? result.value : null);
			ready = local?.status === 204 && remote?.status === 204 && local.app === app && remote.app === app && !!local.instance && local.instance === remote.instance;
		}
		const configured = !!named || current === target;
		return report({ app, port, httpsPort, url: named?.url || url, configured, state: ready ? 'ready' : configured ? 'configured' : 'not-configured' });
	}
	if (current && current !== target) throw Error('This Tailscale port already forwards to another app. Its routing was left unchanged.');
	const namedUrl = `https://${service}.${host.split('.').slice(1).join('.')}`;
	const tags = status.Self.Tags || [];
	if (opts.plan) return report({ app, port, httpsPort, url, state: 'plan', actions: [
		'use the ordinary Tailscale login', `publish only this app on HTTPS port ${httpsPort}`, 'save this app settings',
		...(opts.named ? [tags.length ? `also serve ${namedUrl} (Tailscale Service svc:${service})` : `app-name address ${namedUrl}: needs three one-time steps in the admin console first (shown by setup --name)`] : []),
		...(opts.unnamed ? [`stop serving svc:${service} on this PC`] : []),
	] });
	if (!publish) throw Error('The app connection command is unavailable.');
	const result = await publish({ port, httpsPort, service, public: opts.public });
	if (!result?.url) throw Error(result?.reason || 'Tailscale connection setup did not finish.');
	const save = async (name) => {
		const settings = { version: 2, app, port, httpsPort, mode: opts.public ? 'public' : 'private', ...(name ? { name } : {}) };
		await mkdir(opts.dataDir, { recursive: true });
		const temp = join(opts.dataDir, `${SETTINGS}.${process.pid}.tmp`);
		await writeFile(temp, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
		await rename(temp, join(opts.dataDir, SETTINGS));
	};
	const done = { app, port, httpsPort, url: result.url, configured: true, state: 'setup-complete', next: `Run ${app} to print its QR and connection link.` };
	if (opts.unnamed) {
		// Ends this PC's endpoint only; the Service and the PC's tag stay in the tailnet.
		await run(['serve', 'clear', `svc:${service}`], { timeout: 30000 });
		await save(null);
		return report({ ...done, actions: [`stopped serving ${namedUrl} on this PC`, ...(tags.length ? [`this PC keeps its tag (${tags.join(', ')}): to own it with your account again, sign in again with "tailscale up --force-reauth"`] : [])] });
	}
	if (!opts.named) {
		await save(saved?.name);
		return report(done);
	}
	if (!tags.length) {
		// The admin console has to come first: a Service host must be a tagged PC.
		await save(saved?.name);
		const guide = namedAddressGuide({ app: service });
		return report({ ...done, state: 'named-needs-admin', namedUrl, actions: [`${app} works now at ${result.url}. For ${namedUrl}, once:`, ...guide.steps], policy: guide.policy, next: guide.policy });
	}
	const served = await run(['serve', `--service=svc:${service}`, '--https=443', `https+insecure://127.0.0.1:${port}`], { timeout: 30000 });
	if (served.code !== 0) {
		const guide = namedAddressGuide({ app: service, tag: tags[0] });
		throw Error(`Tailscale did not take ${namedUrl}: ${served.output.trim() || 'no answer'}\nCheck the one-time steps:\n${guide.steps.slice(0, 3).join('\n')}`);
	}
	await save(service);
	const pending = /approv/i.test(served.output);
	return report({ ...done, url: namedUrl, namedUrl, state: pending ? 'named-pending-approval' : 'setup-complete', actions: [
		`app-name address: ${namedUrl} (also ${result.url})`,
		...(pending ? [`approve this PC once: https://console.tailscale.com/admin/services → svc:${service} → Service hosts → Approve (or add the autoApprovers lines from "${app} remote setup --name" on an untagged PC)`] : []),
		...(app === 'handide' ? ['this PC is tagged: handide no longer finds your other PCs by itself (add them with "handide devices add")'] : []),
	] });
}
