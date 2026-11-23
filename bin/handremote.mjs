#!/usr/bin/env node
// handremote: the PC's windows, widgets, tray and servers on the phone, laid out for it.
import { resolve } from 'node:path';
import { startTailscale } from '../server/tailscale.mjs';
import { readRemoteSettings, runRemoteSetup } from '../server/remote-setup.mjs';
import { helperStatus, installHelper, uninstallHelper } from '../server/helper.mjs';
import { startServer, VERSION, dataDirDefault } from '../server/server.mjs';
import { readDevices, writeDevices } from '../server/devices.mjs';
import { installService, serviceStatus, uninstallService } from '../server/service.mjs';

const HELP = `handremote ${VERSION}: your PC's windows, widgets, tray and servers on your phone

  handremote [options]                 start; scan the QR code with the phone
  handremote remote setup [options]    set up the normal Tailscale connection
  handremote remote status [--json]    inspect this app's connection
  handremote helper install            add the SYSTEM helper (one UAC prompt): elevated
                                       windows, UAC prompts, lock and sign-in screens
  handremote helper uninstall          remove it and everything it changed
  handremote helper status
  handremote service install [opts]    start at logon and again whenever it exits (the
                                       options are kept, e.g. --port); takes over from
                                       a handremote started by hand
  handremote service uninstall         stop it and remove it from logon
  handremote service status
  handremote devices                   the phones paired, with their permissions
  handremote devices remove <id>       unpair one (it stops at once, even while running)

  --port <n>       port (default 9100, or saved by remote setup)
  --service-name <name> an existing named Tailscale Service (optional)
  --data-dir <path> this app's settings directory
  --local          this PC only (http://localhost, no certificate)
  --no-remote      skip the Tailscale link (same Wi-Fi only)
  --ts-port <n>    the Tailscale HTTPS port (default 9443; 443 stays handide's)
  --new-token      replace the PC link: QR codes and links handed out so far stop pairing
                   new phones (paired ones stay; remove them with "devices remove")

With handide running too, handide's phone menu shows a "PC" tile that opens handremote
through handide's own address and access token.`;

const log = (m) => console.log(`[handremote] ${m}`);

async function main(argv) {
	const dataDirAt = argv.indexOf('--data-dir');
	if (dataDirAt >= 0 && (!argv[dataDirAt + 1] || argv[dataDirAt + 1].startsWith('--'))) throw Error('Missing --data-dir value.');
	const dataDir = dataDirAt >= 0 ? resolve(argv[dataDirAt + 1]) : dataDirDefault();
	if (argv[0] === 'remote') return runRemoteSetup({ app: 'handremote', defaultPort: 9100, dataDir, args: argv.slice(1), log: argv.includes('--json') ? console.log : log, publish: opts => startTailscale({ port: opts.port, httpsPort: opts.httpsPort, tls: true, log, service: opts.service }) });
	if (argv.includes('--help') || argv.includes('-h')) return console.log(HELP);
	if (argv.includes('--version') || argv.includes('-v')) return console.log(VERSION);
	if (argv[0] === 'helper') {
		const what = argv[1] || 'status';
		const show = (s) => console.log(JSON.stringify(s, null, 2));
		if (what === 'install') return show(await installHelper({ version: VERSION, log }));
		if (what === 'uninstall') return show(await uninstallHelper({ log }));
		if (what === 'status') return show(await helperStatus());
		throw new Error(`unknown: helper ${what}`);
	}
	if (argv[0] === 'service') {
		const what = argv[1] || 'status';
		if (what === 'install') return installService({ args: argv.slice(2), dataDir, log });
		if (what === 'uninstall') return uninstallService({ log });
		if (what === 'status') return log(serviceStatus());
		throw new Error(`unknown: service ${what}`);
	}
	if (argv[0] === 'devices') {
		const dir = dataDir;
		const list = readDevices(dir);
		if (argv[1] === 'remove') {
			const left = list.filter((d) => d.id !== argv[2]);
			if (left.length === list.length) throw new Error(`no device ${argv[2] || ''}`);
			writeDevices(dir, left);
			return console.log(`removed ${argv[2]}`);
		}
		if (!list.length) return console.log('no phones paired yet');
		for (const d of list) {
			const perms = Object.entries(d.perms).filter(([, v]) => v).map(([k]) => k);
			console.log(`${d.id}  ${d.name}  [${perms.join(', ') || 'view only'}]  last seen ${new Date(d.seen).toLocaleString()}`);
		}
		return;
	}
	if (process.platform !== 'win32') throw new Error('handremote runs on Windows for now (macOS later)');
	const opt = (name, def) => {
		const i = argv.indexOf(name);
		return i >= 0 ? argv[i + 1] : def;
	};
	const remoteSettings = await readRemoteSettings(dataDir, 'handremote');
	await startServer({
		dataDir,
		tailscaleService: opt('--service-name', process.env.HANDREMOTE_TAILSCALE_SERVICE || remoteSettings?.name || 'handremote'),
		port: Number(opt('--port', remoteSettings?.port || 9100)),
		tsPort: Number(opt('--ts-port', remoteSettings?.httpsPort || 9443)),
		local: argv.includes('--local'),
		remote: !argv.includes('--no-remote'),
		newToken: argv.includes('--new-token'),
		log,
	});
}

main(process.argv.slice(2)).catch((err) => {
	console.error(`[handremote] ${err.message}`);
	process.exit(1);
});
