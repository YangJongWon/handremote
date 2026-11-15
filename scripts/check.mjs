// End-to-end check: a private handremote (own data dir, --local), a Notepad of its own, and
// the phone UI in emulated phones. Writes check-output/report.json and a screenshot per step.
//
//   npm run check [-- --devices "Pixel 7,iPhone 14"] [-- --keep]
//
// It brings its Notepad to the front to type into it: the PC shows that for a few seconds.
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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

/** True when the window no longer exists. */
const notepadGone = (hwnd) =>
	ps(`Add-Type -Namespace C -Name W -MemberDefinition '[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);'
-not [C.W]::IsWindow([IntPtr]${hwnd})`).then((o) => /True/.test(o));

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
	// A Downloads folder of its own: the real one is never written to or opened.
	const downloadsDir = join(home, 'downloads-check');
	mkdirSync(downloadsDir);
	console.log(`handremote check: ${deviceNames.join(', ')} · data ${home}`);

	const server = spawn(process.execPath, [join(ROOT, 'bin/handremote.mjs'), '--local', '--no-remote', '--port', String(PORT)], {
		env: { ...process.env, HANDREMOTE_HOME: home, HANDREMOTE_DOWNLOADS: downloadsDir },
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

		browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
		for (const name of deviceNames) {
			const dev = DEVICES[name];
			assert(dev, `unknown device ${name}`);
			console.log(`\n${name}`);
			const context = await browser.newContext({ ...dev, locale: 'ko-KR', permissions: ['microphone'] });
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

			// Ctrl+S in the untitled test Notepad opens Save As; Esc cancels it (nothing is saved).
			await step('dialog: Save As is followed, and Esc comes back to the window', async () => {
				await page.evaluate(() => viewer.ws.send(JSON.stringify({ t: 'key', vk: 0x53, mods: 'ctrl' })));
				let dlg = null;
				for (let i = 0; i < 40 && !dlg; i++) {
					await sleep(250);
					dlg = await page.evaluate(() => (viewer.hwnd && viewer.parent ? { hwnd: viewer.hwnd, title: document.getElementById('v-title').textContent } : null));
				}
				assert(dlg, 'the viewer did not follow the dialog');
				await page.waitForFunction(() => document.getElementById('screen').naturalWidth > 0, null, { timeout: 15000 });
				await sleep(600);
				await shot('dialog');
				await page.evaluate(() => viewer.ws.send(JSON.stringify({ t: 'key', vk: 0x1b, mods: '' })));
				let back = false;
				for (let i = 0; i < 40 && !back; i++) {
					await sleep(250);
					back = await page.evaluate((h) => viewer.hwnd === h && !viewer.parent, win.hwnd);
				}
				assert(back, 'did not come back to Notepad');
				await page.waitForFunction(() => document.getElementById('screen').naturalWidth > 0, null, { timeout: 15000 });
				return `"${dlg.title}" → back`;
			});

			await step('sound: the button goes muted → this window → whole PC → muted', async () => {
				const seen = [];
				const answers = [];
				page.on('websocket', () => {});
				await page.evaluate(() => {
					window.__soundMsgs = [];
					const ws = viewer.ws;
					ws.addEventListener('message', (e) => typeof e.data === 'string' && JSON.parse(e.data).t === 'sound' && window.__soundMsgs.push(JSON.parse(e.data)));
				});
				const start = await page.locator('#v-sound').getAttribute('data-mode');
				for (let i = 0; i < 3; i++) {
					await page.locator('#v-sound').click();
					seen.push(await page.locator('#v-sound').getAttribute('data-mode'));
					await sleep(1200);
				}
				const msgs = await page.evaluate(() => window.__soundMsgs);
				for (const m of msgs) answers.push(`${m.mode}${m.error ? `(${m.error})` : ''}`);
				assert(start === 'off' && seen.join(',') === 'window,all,off', `modes ${start} → ${seen}`);
				assert(msgs.length === 3 && msgs.every((m) => !m.error), `PC answered ${answers.join(', ')}`);
				return `PC: ${answers.join(' → ')}`;
			});

			// This PC may have no VB-CABLE: then the phone must say how to install it; with it,
			// the button must stay on and the PC must name the cable.
			await step('mic: 🎤 turns the microphone on, or shows how to install the cable', async () => {
				await page.evaluate(() => {
					window.__micMsgs = [];
					viewer.ws.addEventListener('message', (e) => typeof e.data === 'string' && JSON.parse(e.data).t === 'mic' && window.__micMsgs.push(JSON.parse(e.data)));
				});
				await page.locator('#v-mic').click();
				await page.waitForFunction(() => window.__micMsgs.length > 0, null, { timeout: 8000 });
				const [m] = await page.evaluate(() => window.__micMsgs);
				if (m.error === 'no-cable') {
					await page.locator('#sheet:not([hidden]) .sheet-steps li').first().waitFor({ timeout: 3000 });
					await shot('mic-guide');
					assert((await page.locator('#v-mic').getAttribute('aria-pressed')) === 'false', 'mic button stayed on');
					await page.locator('#sheet-close').click();
					return 'no VB-CABLE here: install guide shown';
				}
				assert(m.on && m.device, `PC answered ${JSON.stringify(m)}`);
				await sleep(800);
				await page.locator('#v-mic').click();
				return `on → ${m.device}`;
			});

			await step('drawer: swipe left from the right edge opens the windows, swipe right closes', async () => {
				const r = await page.locator('#stage').boundingBox();
				const y = r.y + r.height / 2;
				await page.mouse.move(r.x + r.width - 6, y);
				await page.mouse.down();
				await page.mouse.move(r.x + r.width - 140, y, { steps: 8 });
				await page.mouse.up();
				await page.waitForFunction(() => document.getElementById('viewer').classList.contains('drawer-open'), null, { timeout: 3000 });
				await page.locator(`.drawer-row[aria-current="true"]`).waitFor({ timeout: 5000 });
				const rows = await page.locator('.drawer-row').count();
				const d = await page.locator('#drawer').boundingBox();
				await sleep(300);
				await shot('drawer');
				await page.mouse.move(d.x + 30, d.y + d.height / 2);
				await page.mouse.down();
				await page.mouse.move(d.x + 160, d.y + d.height / 2, { steps: 8 });
				await page.mouse.up();
				await page.waitForFunction(() => !document.getElementById('viewer').classList.contains('drawer-open'), null, { timeout: 3000 });
				return `${rows} windows, ${Math.round(d.width)} of ${Math.round(r.width)} px`;
			});

			// The page going away (home screen, or handide hiding its preview) lets go of the
			// window; coming back lays it out for the phone again.
			const sizeOf = async () => (await page.evaluate(() => fetch('api/list').then((r) => r.json()))).windows.find((w) => w.hwnd === win.hwnd);
			const waitSize = async (ok) => {
				let now;
				for (let i = 0; i < 24; i++) {
					await sleep(250);
					now = await sizeOf();
					if (now && ok(now)) return now;
				}
				throw new Error(`size stayed ${now?.w}x${now?.h} (original ${before.w}x${before.h})`);
			};
			const original = (w) => Math.abs(w.w - before.w) <= 2 && Math.abs(w.h - before.h) <= 2;
			const setHidden = (hidden) =>
				page.evaluate((h) => {
					Object.defineProperty(document, 'hidden', { value: h, configurable: true });
					document.dispatchEvent(new Event('visibilitychange'));
				}, hidden);
			await step('leave: the page going away gives the window its size back', async () => {
				const fitted = await sizeOf();
				await setHidden(true);
				const now = await waitSize(original);
				return `${fitted.w}x${fitted.h} → ${now.w}x${now.h}`;
			});
			await step('leave: coming back lays it out for the phone again', async () => {
				await setHidden(false);
				const now = await waitSize((w) => !original(w));
				await page.waitForFunction(() => document.getElementById('screen').naturalWidth > 0, null, { timeout: 15000 });
				return `${now.w}x${now.h}`;
			});
			await step('leave: handide hiding its preview does the same', async () => {
				await page.evaluate(() => window.postMessage({ handide: 'preview', visible: false }, location.origin));
				await waitSize(original);
				await page.evaluate(() => window.postMessage({ handide: 'preview', visible: true }, location.origin));
				const now = await waitSize((w) => !original(w));
				return `back to ${now.w}x${now.h}`;
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

			// A second, empty Notepad of its own (nothing to save, so it closes without asking).
			// "Close all" would reach the user's own Notepads too: it is only looked at, never tapped.
			await step('close: ✕ → "close this window" closes only that window', async () => {
				const spare = spawn(join(process.env.SystemRoot, 'System32', 'notepad.exe'), [], { detached: true, stdio: 'ignore' });
				let exited = false;
				spare.on('exit', () => (exited = true));
				try {
					let w;
					for (let i = 0; i < 40 && !w; i++) {
						await page.evaluate(() => document.getElementById('refresh').click());
						const data = await page.evaluate(() => fetch('api/list').then((r) => r.json()));
						w = data.windows.find((x) => x.pid === spare.pid);
						if (!w) await sleep(250);
					}
					assert(w, 'spare Notepad not listed');
					const close = page.locator(`.row-wrap:has(.row[data-hwnd="${w.hwnd}"]) .row-close`);
					await close.waitFor({ timeout: 8000 });
					await close.click();
					const acts = await page.locator('#sheet .sheet-act').allInnerTexts();
					assert(acts.length === 2 && /notepad/i.test(acts[1]), `sheet actions: ${JSON.stringify(acts)}`);
					await shot('close-sheet');
					await page.locator('#sheet .sheet-act').first().click();
					for (let i = 0; i < 20 && !exited; i++) await sleep(250);
					assert(exited, 'spare Notepad still running');
					assert(!(await notepadGone(win.hwnd)), 'the first test Notepad closed too');
					return acts.join(' | ');
				} finally {
					if (!exited) try { process.kill(spare.pid); } catch {}
				}
			});

			// A browser finishing a download: written under a temporary name, then renamed.
			await step('download: a finished download is announced, "folder" opens and shows Explorer', async () => {
				const file = `check-${name.replace(/\W+/g, '')}-${Date.now()}.txt`;
				const tmp = join(downloadsDir, `${file}.crdownload`);
				writeFileSync(tmp, 'handremote check download');
				await sleep(300);
				renameSync(tmp, join(downloadsDir, file));
				await page.locator('#banner.in').waitFor({ timeout: 15000 });
				const text = await page.locator('#banner').innerText();
				assert(text.includes(file), `banner: ${text}`);
				await shot('download-banner');
				await page.locator('#banner .banner-act').nth(1).click();
				let shown = null;
				for (let i = 0; i < 40 && !shown; i++) {
					await sleep(250);
					shown = await page.evaluate(() => (viewer.ws && viewer.hwnd ? { hwnd: viewer.hwnd, title: document.getElementById('v-title').textContent } : null));
				}
				assert(shown, 'no window was shown after "folder"');
				// Close the Explorer window it opened (ours: it shows the check's own folder).
				const ok = /downloads-check/i.test(shown.title);
				await page.evaluate((h) => fetch('api/close', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hwnds: [h] }) }), ok ? shown.hwnd : 0);
				assert(ok, `showed "${shown.title}" instead of the check's folder`);
				await page.waitForFunction(() => document.getElementById('viewer').hidden, null, { timeout: 8000 });
				return `"${shown.title}"`;
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
