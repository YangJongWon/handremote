#!/usr/bin/env node
// handremote: the PC's windows, widgets, tray and servers on the phone, laid out for it.
import { helperStatus, installHelper, uninstallHelper } from '../server/helper.mjs';
import { startServer, VERSION } from '../server/server.mjs';

const HELP = `handremote ${VERSION}: your PC's windows, widgets, tray and servers on your phone

  handremote [options]                 start; scan the QR code with the phone
  handremote helper install            add the SYSTEM helper (one UAC prompt): elevated
                                       windows, UAC prompts, lock and sign-in screens
  handremote helper uninstall          remove it and everything it changed
  handremote helper status

  --port <n>       port (default 9100)
  --local          this PC only (http://localhost, no certificate)
  --no-remote      skip the Tailscale link (same Wi-Fi only)
  --ts-port <n>    the Tailscale HTTPS port (default 9443; 443 stays handide's)
  --new-token      replace the access token: every link handed out so far stops working

With handide running too, handide's phone menu shows a "PC" tile that opens handremote
through handide's own address and access token.`;

const log = (m) => console.log(`[handremote] ${m}`);

async function main(argv) {
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
	if (process.platform !== 'win32') throw new Error('handremote runs on Windows for now (macOS later)');
	const opt = (name, def) => {
		const i = argv.indexOf(name);
		return i >= 0 ? argv[i + 1] : def;
	};
	await startServer({
		port: Number(opt('--port', 9100)),
		tsPort: Number(opt('--ts-port', 9443)),
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
