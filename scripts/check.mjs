// End-to-end check: a private handremote (own data dir, --local), a Notepad of its own, and
// the phone UI in emulated phones. Writes check-output/report.json and a screenshot per step.
//
//   npm run check [-- --devices "Pixel 7,iPhone 14"] [-- --keep]
//
// It brings its Notepad to the front to type into it: the PC shows that for a few seconds.
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices as DEVICES } from 'playwright';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'check-output');
const argv = process.argv.slice(2);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const deviceNames = opt('--devices', 'Pixel 7').split(',').map((s) => s.trim());
const PORT = Number(opt('--port', 9190));
const TEXT = '가나다abc';

const results = [];
let failed = 0;
const step = async (name, fn) => {
	const started = Date.now();
	try {
		const detail = await fn();
		results.push({ name, ok: true, ms: Date.now() - started, detail: detail ?? null });
		console.log(`  ok   ${name}${detail ? ` (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`);
	} catch (err) {
		failed++;
		results.push({ name, ok: false, ms: Date.now() - started, error: err.message });
		console.log(`  FAIL ${name}: ${err.message}`);
	}
};
const assert = (cond, msg) => {
	if (!cond) throw new Error(msg);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ps = (script) =>
	new Promise((resolve, reject) =>
		execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, (err, out) => (err ? reject(err) : resolve(out.trim()))),
	);

/** Notepad's text, read from its Edit control (WM_GETTEXT). */
const notepadText = (hwnd) =>
	ps(`Add-Type -Namespace C -Name N -MemberDefinition '[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string t); [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, int m, IntPtr w, System.Text.StringBuilder l);'
$e = [C.N]::FindWindowEx([IntPtr]${hwnd}, [IntPtr]::Zero, 'Edit', $null); $sb = New-Object Text.StringBuilder 1024; [void][C.N]::SendMessage($e, 0x0D, [IntPtr]1024, $sb)
[Console]::OutputEncoding = [Text.Encoding]::UTF8; $sb.ToString()`);

function get(path, headers = {}) {
	return new Promise((resolve, reject) => {
		http.get({ host: '127.0.0.1', port: PORT, path, headers }, (res) => {
			let body = '';
			res.on('data', (d) => (body += d));
			res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
		}).on('error', reject);
	});
}

const linkGet = (port, secret) =>
	new Promise((resolve) =>
		http
			.get({ host: '127.0.0.1', port, path: '/api/state', headers: { 'x-handremote-secret': secret } }, (res) => (res.resume(), res.on('end', () => resolve(res))))
			.on('error', () => resolve({ statusCode: 0 })),
	);

async function main() {
	rmSync(OUT, { recursive: true, force: true });
	mkdirSync(OUT, { recursive: true });
	const home = mkdtempSync(join(os.tmpdir(), 'handremote-check-'));
	console.log(`handremote check: ${deviceNames.join(', ')} · data ${home}`);

	const server = spawn(process.execPath, [join(ROOT, 'bin/handremote.mjs'), '--local', '--no-remote', '--port', String(PORT)], {
		env: { ...process.env, HANDREMOTE_HOME: home },
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});
	let serverLog = '';
	server.stdout.on('data', (d) => (serverLog += d));
	server.stderr.on('data', (d) => (serverLog += d));
	const notepad = spawn(join(process.env.SystemRoot, 'System32', 'notepad.exe'), [], { detached: true, stdio: 'ignore' });
	let browser;
	try {
		for (let i = 0; i < 60 && !/ready on port/.test(serverLog); i++) await sleep(250);
		assert(/ready on port/.test(serverLog), `server did not start: ${serverLog}`);
		const token = readFileSync(join(home, 'token'), 'utf8').trim();
		const endpoint = JSON.parse(readFileSync(join(home, 'endpoint.json'), 'utf8'));

		await step('auth: no token is refused', async () => {
			const r = await get('/api/list');
			assert(r.status === 403, `status ${r.status}`);
		});
		await step('link: wrong secret is refused', async () => {
			const r = await linkGet(endpoint.port, 'x'.repeat(32));
			assert(r.statusCode === 403, `status ${r.statusCode}`);
		});
		await step('link: right secret is served', async () => {
			const r = await linkGet(endpoint.port, endpoint.secret);
			assert(r.statusCode === 200, `status ${r.statusCode}`);
		});

		browser = await chromium.launch();
		for (const name of deviceNames) {
			const dev = DEVICES[name];
			assert(dev, `unknown device ${name}`);
			console.log(`\n${name}`);
			const context = await browser.newContext({ ...dev, locale: 'ko-KR' });
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', (e) => errors.push(e.message));
			const shot = (s) => page.screenshot({ path: join(OUT, `${name.replace(/\W+/g, '-')}-${s}.png`) });

			let win;
			await step('list: shows the test Notepad under windows', async () => {
				await page.goto(`http://localhost:${PORT}/?tkn=${encodeURIComponent(token)}`);
				for (let i = 0; i < 40 && !win; i++) {
					const data = await page.evaluate(() => fetch('api/list').then((r) => r.json()));
					win = data.windows.find((w) => w.pid === notepad.pid);
					if (!win) await sleep(250);
				}
				assert(win && win.kind === 'app', 'Notepad not listed as a window');
				await page.locator(`.row[data-hwnd="${win.hwnd}"]`).waitFor({ timeout: 8000 });
				await shot('list');
				return `${win.w}x${win.h}`;
			});
			await step('list: tray icons and servers', async () => {
				const data = await page.evaluate(() => fetch('api/list').then((r) => r.json()));
				assert(Array.isArray(data.tray) && Array.isArray(data.servers), 'missing groups');
				return `tray ${data.tray.length}, servers ${data.servers.length}`;
			});

			const before = { w: win.w, h: win.h };
			let stage;
			await step('view: the window is laid out at the phone size and streams', async () => {
				await page.locator(`.row[data-hwnd="${win.hwnd}"]`).click();
				await page.waitForFunction(() => document.getElementById('screen').naturalWidth > 0, null, { timeout: 15000 });
				stage = await page.evaluate(() => {
					const r = document.getElementById('stage').getBoundingClientRect();
					const img = document.getElementById('screen');
					return { w: Math.round(r.width), h: Math.round(r.height), iw: img.naturalWidth, ih: img.naturalHeight };
				});
				await sleep(400);
				await shot('view');
				const ratioStage = stage.w / stage.h;
				const ratioImg = stage.iw / stage.ih;
				assert(Math.abs(ratioStage - ratioImg) < 0.08, `frame ${stage.iw}x${stage.ih} is not the stage's shape ${stage.w}x${stage.h}`);
				return `stage ${stage.w}x${stage.h}, frame ${stage.iw}x${stage.ih}`;
			});

			await step(`input: "${TEXT}" typed from the phone reaches Notepad`, async () => {
				const marker = `${TEXT}-${name.replace(/\W+/g, '')}`;
				await page.fill('#type', marker);
				await page.locator('#typebar button[type=submit]').click();
				let text = '';
				for (let i = 0; i < 20 && !text.includes(marker); i++) {
					await sleep(250);
					text = await notepadText(win.hwnd);
				}
				const toast = await page.locator('#toast').textContent();
				assert(text.includes(marker), `Notepad has "${text}"${toast ? `; phone said: ${toast}` : ''}`);
				await sleep(400);
				await shot('typed');
				return text;
			});

			await step('input: a tap is a click (caret moves to the start)', async () => {
				const box = await page.locator('#screen').boundingBox();
				// Into the text area, left edge of the first line, below the menu bar.
				await page.touchscreen.tap(box.x + 12, box.y + box.height * 0.3);
				await sleep(300);
				await page.locator('.keys button', { hasText: 'Home' }).click();
				await page.fill('#type', '>');
				await page.locator('#typebar button[type=submit]').click();
				let text = '';
				for (let i = 0; i < 12 && !text.startsWith('>'); i++) {
					await sleep(250);
					text = await notepadText(win.hwnd);
				}
				assert(text.startsWith('>'), `Notepad has "${text}"`);
			});

			await step('close: the window gets its size back', async () => {
				await page.locator('#v-close').click();
				let now;
				for (let i = 0; i < 20; i++) {
					await sleep(250);
					const data = await page.evaluate(() => fetch('api/list').then((r) => r.json()));
					now = data.windows.find((w) => w.hwnd === win.hwnd);
					if (now && Math.abs(now.w - before.w) <= 2 && Math.abs(now.h - before.h) <= 2) return `${now.w}x${now.h}`;
						var last = data.windows.filter((w) => w.pid === notepad.pid).map((w) => `${w.hwnd} ${w.kind} ${w.title} ${w.w}x${w.h} min=${w.min}`);
				}
				throw new Error(`still ${now?.w}x${now?.h}, was ${before.w}x${before.h}; Notepad windows now: ${JSON.stringify(last)}`);
			});

			await step('no page errors', async () => assert(!errors.length, errors.join('; ')));
			await context.close();
		}
	} finally {
		await browser?.close();
		try {
			process.kill(notepad.pid);
		} catch {}
		server.kill();
		await sleep(500);
		writeFileSync(join(OUT, 'server.log'), serverLog);
		if (!argv.includes('--keep')) rmSync(home, { recursive: true, force: true });
	}
	writeFileSync(join(OUT, 'report.json'), JSON.stringify({ at: new Date().toISOString(), devices: deviceNames, passed: results.filter((r) => r.ok).length, failed, results }, null, 2));
	console.log(`\n${failed ? `${failed} FAILED` : 'all passed'} · check-output/report.json`);
	process.exit(failed ? 1 : 0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
