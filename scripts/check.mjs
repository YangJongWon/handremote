// End-to-end check: a private handremote (own data dir, --local), a Notepad of its own, and
// the phone UI in emulated phones. Writes check-output/report.json and a screenshot per step.
//
//   npm run check [-- --devices "Pixel 7,iPhone 14"] [-- --keep]
//
// It brings its Notepad to the front to type into it: the PC shows that for a few seconds.
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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

			// Devices: this phone came in through the PC link, so it is the first device (admin).
			// A second phone through a view-only invite may look, and nothing else.
			await step('devices: the PC link pairs this phone as its own device, the first one admin', async () => {
				const me = await page.evaluate(() => fetch('api/me').then((r) => r.json()));
				const names = (await context.cookies()).map((c) => c.name);
				assert(me.device && me.perms.admin && me.perms.control && me.perms.files && me.perms.term, JSON.stringify(me));
				assert(names.includes('hr-dev') && !names.includes('hr-tkn'), `cookies ${names}`);
				await page.goto(`http://localhost:${PORT}/?tkn=${encodeURIComponent(token)}`); // the link again: no second device
				const list = await page.evaluate(() => fetch('api/devices').then((r) => r.json()));
				assert(list.devices.length === 1, `${list.devices.length} devices`);
				return `${me.device.name}`;
			});
			let guest = null;
			await step('devices: a view-only invite lets a second phone look, and nothing else', async () => {
				await page.locator('#open-devices').click();
				await page.locator('.device').first().waitFor({ timeout: 5000 });
				await page.locator('#d-add').click();
				for (const k of ['control', 'files', 'term']) if (await page.locator(`#sheet .perm[data-perm="${k}"].on`).count()) await page.locator(`#sheet .perm[data-perm="${k}"]`).click();
				await page.locator('#d-make').click();
				const url = (await page.locator('#d-invite-url').innerText()).trim();
				await shot('devices-invite');
				await page.locator('#sheet-close').click();
				guest = await browser.newContext({ ...dev, locale: 'ko-KR' });
				const g = await guest.newPage();
				g.on('pageerror', (e) => errors.push(`guest: ${e.message}`));
				await g.goto(url);
				await g.locator(`.row[data-hwnd="${win.hwnd}"]`).waitFor({ timeout: 8000 });
				const me = await g.evaluate(() => fetch('api/me').then((r) => r.json()));
				assert(!me.perms.control && !me.perms.files && !me.perms.term && !me.perms.admin, JSON.stringify(me.perms));
				const codes = await g.evaluate(async () => {
					const st = async (path, body) => (await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})).status;
					return { files: await st('api/files'), term: await st('api/term/list'), close: await st('api/close', { hwnds: [] }), devices: await st('api/devices'), list: await st('api/list') };
				});
				assert(codes.files === 403 && codes.term === 403 && codes.close === 403 && codes.devices === 403 && codes.list === 200, JSON.stringify(codes));
				const hidden = await g.evaluate(() => ['open-files', 'open-term', 'open-devices'].every((id) => document.getElementById(id).hidden) && !document.querySelector('.row-close'));
				assert(hidden, 'files, terminal, devices or close buttons shown');
				// Typing straight into the socket (past the UI) is refused by the PC too.
				const answer = await g.evaluate(
					(hwnd) =>
						new Promise((resolve) => {
							const ws = new WebSocket(`ws://${location.host}/api/view?hwnd=${hwnd}&fit=0&w=390&h=700`);
							ws.onmessage = (e) => {
								if (typeof e.data !== 'string') return;
								const m = JSON.parse(e.data);
								if (m.t === 'ready') ws.send(JSON.stringify({ t: 'text', s: 'must not arrive' }));
								if (m.t === 'error') (resolve(m.code), ws.close());
							};
							setTimeout(() => resolve('no answer'), 8000);
						}),
					win.hwnd,
				);
				assert(answer === 'perm-control', `typing gave ${answer}`);
				assert(!(await notepadText(win.hwnd)).includes('must not arrive'), 'the text reached Notepad');
				const again = await (await browser.newContext()).newPage().then(async (p2) => (await p2.goto(url)).status());
				assert(again === 403, `the invite worked twice (${again})`);
				await page.locator('#devices .device').nth(1).waitFor({ timeout: 5000 }).catch(() => {});
				await page.evaluate(() => showDevices());
				await page.locator('#devices .device').nth(1).waitFor({ timeout: 5000 });
				await shot('devices');
				return 'files, terminal, close, devices refused; typing refused by the PC; invite used up';
			});
			await step('devices: unpairing cuts the phone off at once, the last admin stays admin', async () => {
				const g = guest.pages()[0];
				const opened = await g.evaluate(
					(hwnd) =>
						new Promise((resolve) => {
							const ws = new WebSocket(`ws://${location.host}/api/view?hwnd=${hwnd}&fit=0&w=390&h=700`);
							window.__guestWs = ws;
							ws.onmessage = (e) => typeof e.data === 'string' && JSON.parse(e.data).t === 'ready' && resolve(true);
							setTimeout(() => resolve(false), 8000);
						}),
					win.hwnd,
				);
				assert(opened, 'the guest view did not open');
				page.once('dialog', (d) => d.accept());
				await page.locator('#devices .device').nth(1).locator('[data-act="remove"]').click();
				await page.waitForFunction(() => document.querySelectorAll('#devices .device').length === 1, null, { timeout: 5000 });
				await g.waitForFunction(() => window.__guestWs.readyState === 3, null, { timeout: 5000 });
				const status = await g.evaluate(() => fetch('api/list').then((r) => r.status));
				assert(status === 403, `removed device still gets ${status}`);
				const last = await page.evaluate(async () => {
					const me = await fetch('api/me').then((r) => r.json());
					const r = await fetch('api/devices/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: me.device.id, perms: { admin: false } }) });
					return { status: r.status, code: (await r.json()).code };
				});
				assert(last.status === 409 && last.code === 'last-admin', JSON.stringify(last));
				await guest.close();
				await page.locator('#d-close').click();
				return 'its open view closed, its requests refused';
			});

			const before = { w: win.w, h: win.h };
			let stage;
			// The connection screen (never its "start with the PC" switch: that is the real Startup folder).
			await step('diag: tapping the PC name shows the path, response time, speeds and the PC parts', async () => {
				await page.locator('#open-diag').click();
				await page.locator('#dg-run').waitFor({ timeout: 20000 });
				const rows = await page.locator('#diag .diag-row').allInnerTexts();
				const get = (label) => (rows.find((r) => r.startsWith(label)) || '').slice(label.length).trim();
				assert(get('연결 경로') === '이 PC', `path ${get('연결 경로')}`);
				assert(/^\d+ ms$/.test(get('응답 시간')), `rtt ${get('응답 시간')}`);
				assert(/Mbps$/.test(get('받기 속도')) && /Mbps$/.test(get('보내기 속도')), 'speeds missing');
				for (const part of ['화면', '조작', '소리']) assert(/^\d+ ms$/.test(get(part)), `${part}: ${get(part)}`);
				await shot('diag');
				await page.locator('#dg-close').click();
				await page.locator('#diag').waitFor({ state: 'hidden', timeout: 3000 });
				return `rtt ${get('응답 시간')}, down ${get('받기 속도')}, up ${get('보내기 속도')}`;
			});

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
				await page.locator('#keys button', { hasText: 'Home' }).click();
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
			// Fingers as pointer events on the stage (Playwright's mouse is one pointer only).
			const touch = (steps) =>
				page.evaluate(async (steps) => {
					const stage = document.getElementById('stage');
					const r = stage.getBoundingClientRect();
					const fire = (type, id, x, y) =>
						stage.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true }));
					for (const [type, id, x, y, wait] of steps) {
						fire(type, id, x, y);
						await new Promise((res) => setTimeout(res, wait ?? 16));
					}
				}, steps);
			const spreadSteps = (cx, cy) => {
				const out = [['pointerdown', 1, cx - 30, cy], ['pointerdown', 2, cx + 30, cy]];
				for (let i = 1; i <= 10; i++) out.push(['pointermove', 1, cx - 30 - i * 10, cy], ['pointermove', 2, cx + 30 + i * 10, cy]);
				return [...out, ['pointerup', 1, cx - 130, cy], ['pointerup', 2, cx + 130, cy]];
			};

			await step('zoom: spreading two fingers zooms the picture, one finger pans, the chip goes back', async () => {
				const box = await page.locator('#stage').boundingBox();
				const cx = Math.round(box.width / 2);
				const cy = Math.round(box.height / 2);
				await touch(spreadSteps(cx, cy));
				const z1 = await page.evaluate(() => ({ ...zoom }));
				assert(z1.s > 2, `zoom ${z1.s}`);
				assert(await page.locator('#v-zoom').isVisible(), 'no zoom chip');
				const moves = [['pointerdown', 1, cx, cy]];
				for (let i = 1; i <= 8; i++) moves.push(['pointermove', 1, cx + i * 10, cy + i * 5]);
				moves.push(['pointerup', 1, cx + 80, cy + 40]);
				await touch(moves);
				const z2 = await page.evaluate(() => ({ ...zoom }));
				assert(z2.x !== z1.x || z2.y !== z1.y, 'one finger did not pan');
				await shot('zoomed');
				await page.locator('#v-zoom').click();
				const z3 = await page.evaluate(() => zoom.s);
				assert(z3 === 1 && !(await page.locator('#v-zoom').isVisible()), `back to ${z3}`);
				return `${z1.s.toFixed(1)}×, panned ${Math.round(z2.x - z1.x)},${Math.round(z2.y - z1.y)} px`;
			});

			await step('pointer: the mode button gives a cursor; a slow move is finer than a fast one; a tap clicks at the cursor', async () => {
				await page.evaluate(() => {
					window.__sent = [];
					const ws = viewer.ws;
					const orig = ws.send.bind(ws);
					ws.send = (d) => (typeof d === 'string' && window.__sent.push(JSON.parse(d)), orig(d));
				});
				while ((await page.locator('#v-drag').getAttribute('data-mode')) !== 'pointer') await page.locator('#v-drag').click();
				await page.locator('#cursor').waitFor({ timeout: 3000 });
				const box = await page.locator('#stage').boundingBox();
				const y = Math.round(box.height / 2);
				const before = await page.evaluate(() => cursor.fx);
				// 60 px slowly (precise), then 60 px fast.
				const slow = [['pointerdown', 1, 100, y, 30]];
				for (let i = 1; i <= 12; i++) slow.push(['pointermove', 1, 100 + i * 5, y, 40]);
				slow.push(['pointerup', 1, 160, y, 30]);
				await touch(slow);
				const mid = await page.evaluate(() => cursor.fx);
				const fast = [['pointerdown', 1, 100, y, 10]];
				for (let i = 1; i <= 3; i++) fast.push(['pointermove', 1, 100 + i * 20, y, 8]);
				fast.push(['pointerup', 1, 160, y, 30]);
				await touch(fast);
				const after = await page.evaluate(() => cursor.fx);
				assert(mid > before && after - mid > (mid - before) * 1.5, `slow ${mid - before}, fast ${after - mid}`);
				await touch([['pointerdown', 1, 50, 50, 40], ['pointerup', 1, 50, 50, 300]]);
				const sent = await page.evaluate(() => window.__sent.filter((m) => m.t === 'mouse'));
				const click = sent.find((m) => m.a === 'click');
				assert(sent.some((m) => m.a === 'move'), 'no cursor moves sent');
				assert(click && Math.abs(click.fx - after) < 0.001, `click at ${click?.fx} not at the cursor ${after}`);
				await shot('pointer');
				while ((await page.locator('#v-drag').getAttribute('data-mode')) !== 'touch') await page.locator('#v-drag').click();
				assert(await page.locator('#cursor').isHidden(), 'cursor still shown in touch mode');
				return `cursor ${before.toFixed(2)} → ${mid.toFixed(2)} (slow) → ${after.toFixed(2)} (fast), click at the cursor`;
			});

			await step('reconnect: a dropped view comes back to the same window, the picture kept', async () => {
				const before = await page.evaluate(() => viewer.hwnd);
				await page.evaluate(() => viewer.ws.close()); // as a network drop would
				await page.locator('#v-status:not([hidden])').waitFor({ timeout: 3000 });
				const kept = await page.evaluate(() => !!document.getElementById('screen').getAttribute('src'));
				await page.waitForFunction((h) => viewer.ws?.readyState === 1 && viewer.hwnd === h && document.getElementById('v-status').hidden, before, { timeout: 15000 });
				assert(kept, 'the picture was cleared while reconnecting');
				return 'status shown, picture kept, same window again';
			});

			// A slow network (40 KB/s) while the window keeps changing: the quality goes down.
			await step('stream: quality follows a slow network', async () => {
				await page.evaluate(() => {
					window.__q = [];
					viewer.ws.addEventListener('message', (e) => {
						if (typeof e.data === 'string') {
							const m = JSON.parse(e.data);
							if (m.t === 'frame') window.__q.push(m.q);
						}
					});
				});
				const cdp = await context.newCDPSession(page);
				await cdp.send('Network.enable');
				await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 40 * 1024, uploadThroughput: 40 * 1024 });
				for (let i = 0; i < 24; i++) {
					await page.evaluate((n) => viewer.ws.send(JSON.stringify({ t: 'text', s: `slow network line ${n} ${'#'.repeat(40)}\n` })), i);
					await sleep(400);
				}
				await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
				const qs = await page.evaluate(() => window.__q);
				assert(qs.length && Math.min(...qs) < qs[0], `quality stayed ${JSON.stringify(qs.slice(0, 20))}`);
				return `quality ${qs[0]} → ${Math.min(...qs)} over ${qs.length} frames`;
			});

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
				await sleep(400);
				const still = await page.evaluate(() => viewer.hwnd);
				assert(still === win.hwnd, `the swipe also opened window ${still}`);
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
				const dbg = await page.evaluate(() => JSON.stringify({ paused: viewer.paused, fitted: viewer.fitted, ws: !!viewer.ws, hidden: document.getElementById('viewer').hidden }));
				await setHidden(false);
				const now = await waitSize((w) => !original(w)).catch((e) => { throw new Error(`${e.message} ${dbg}`); });
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

			// Only the check's own folder is listed, uploaded into and downloaded from.
			await step('files: places, a folder, upload from the phone, save to the phone', async () => {
				await page.locator('#open-files').click();
				await page.locator('#files-list .group').first().waitFor({ timeout: 8000 });
				const groups = await page.locator('#files-list .group h2').allInnerTexts();
				await page.evaluate((d) => showFolder(d), downloadsDir);
				await page.locator('#files-list .rows .row').first().waitFor({ timeout: 8000 });
				const up = `upload-${Date.now()}.txt`;
				await page.locator('#f-pick').setInputFiles({ name: up, mimeType: 'text/plain', buffer: Buffer.from('from the phone') });
				let saved = '';
				for (let i = 0; i < 20 && saved !== 'from the phone'; i++) {
					await sleep(250);
					try {
						saved = readFileSync(join(downloadsDir, up), 'utf8');
					} catch {}
				}
				assert(saved === 'from the phone', 'the upload did not reach the folder');
				await page.locator('#files-list .row', { hasText: up }).waitFor({ timeout: 8000 });
				await shot('files');
				const back = await page.evaluate((path) => fetch(`api/file?path=${encodeURIComponent(path)}`).then((r) => r.text()), join(downloadsDir, up));
				assert(back === 'from the phone', `download gave "${back}"`);
				// A big one on a slow link: progress shows, cancel stops it, no half file stays.
				const cdp = await context.newCDPSession(page);
				await cdp.send('Network.enable');
				await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 50, downloadThroughput: -1, uploadThroughput: 300 * 1024 });
				const big = `big-${Date.now()}.bin`;
				await page.locator('#f-pick').setInputFiles({ name: big, mimeType: 'application/octet-stream', buffer: Buffer.alloc(6 << 20, 7) });
				await page.locator('.up-box').waitFor({ timeout: 5000 });
				let shown = '';
				for (let i = 0; i < 40 && !/^[1-9]\d*%/.test(shown); i++) {
					await sleep(250);
					shown = await page.locator('.up-box small').innerText().catch(() => '');
				}
				await shot('upload-progress');
				await page.locator('.up-box button').click();
				await page.locator('.up-box').waitFor({ state: 'detached', timeout: 5000 });
				await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
				let left = true;
				for (let i = 0; i < 20 && left; i++) {
					await sleep(250);
					left = existsSync(join(downloadsDir, big));
				}
				assert(/^[1-9]\d*%/.test(shown), `no progress shown ("${shown}")`);
				assert(!left, 'the cancelled upload left a file');
				await page.locator('#f-close').click();
				return `${groups.join(', ')}; up and down ${up}; cancelled at ${shown.split(' ')[0]}, nothing left`;
			});

			await step('terminal: PowerShell runs a command, Korean too, and is there again after leaving', async () => {
				await page.locator('#open-term').click();
				await page.locator('#term-screen .xterm').waitFor({ timeout: 15000 });
				const screen = () => page.evaluate(() => {
					const b = term.xterm.buffer.active;
					let out = '';
					for (let i = 0; i < b.length; i++) out += (b.getLine(i)?.translateToString(true) || '') + '\n';
					return out;
				});
				const waitFor = async (re) => {
					for (let i = 0; i < 60; i++) {
						const text = await screen();
						if (re.test(text)) return text;
						await sleep(250);
					}
					throw new Error(`terminal shows: ${(await screen()).trim().slice(-300)}`);
				};
				await waitFor(/PS [A-Z]:\\/);
				await page.fill('#term-type', 'Write-Output "sum=$(20+22) 한글"');
				await page.locator('#term-form button[type=submit]').click();
				await waitFor(/sum=42 한글/);
				const cols = await page.evaluate(() => term.xterm.cols);
				await shot('terminal');
				const id = await page.evaluate(() => term.id);
				await page.locator('#t-close').click();
				await sleep(500);
				await page.evaluate(() => (term.ready = null));
				await page.locator('#open-term').click();
				await page.waitForFunction(() => term.ready && term.ws?.readyState === 1, null, { timeout: 15000 });
				const resumed = await page.evaluate(() => term.ready.resumed);
				await waitFor(/sum=42 한글/); // replayed by the PC into a cleared screen
				const again = await page.evaluate(() => term.id);
				assert(resumed && again === id, `a new terminal (${again}, resumed ${resumed}) instead of ${id}`);
				// The picker: installed shells; a second terminal (Python if installed, else cmd)
				// next to PowerShell, then back to PowerShell.
				await page.locator('#term-shell').click();
				await page.locator('#sheet:not([hidden]) .row').first().waitFor({ timeout: 10000 });
				const names = await page.locator('#sheet .row .t1').allInnerTexts();
				const second = names.includes('Python') ? 'Python' : 'Command Prompt';
				await page.locator('#sheet .row', { hasText: second }).last().click();
				await page.waitForFunction((n) => term.ready?.shell?.name === n && term.ws?.readyState === 1, second, { timeout: 15000 });
				if (second === 'Python') {
					await waitFor(/>>> /);
					await page.fill('#term-type', 'print(6*7, "파이썬")');
				} else {
					await waitFor(/>$/m);
					await page.fill('#term-type', 'echo 42 파이썬');
				}
				await page.locator('#term-form button[type=submit]').click();
				await waitFor(/42 파이썬/);
				await shot('terminal-second');
				const secondId = await page.evaluate(() => term.id);
				await page.locator('#term-shell').click();
				await page.locator('#sheet:not([hidden]) .row').first().waitFor({ timeout: 10000 });
				await page.locator('#sheet .row', { hasText: 'Windows PowerShell' }).first().click();
				await page.waitForFunction((id) => term.ready?.id === id && term.ws?.readyState === 1, id, { timeout: 15000 });
				await waitFor(/sum=42/);
				// end both
				await page.evaluate(() => term.ws.send(JSON.stringify({ t: 'kill' })));
				await page.evaluate((other) => {
					const u = new URL(`api/term?id=${other}`, location.href);
					u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
					const w = new WebSocket(u);
					w.onopen = () => w.send(JSON.stringify({ t: 'kill' }));
				}, secondId);
				await sleep(500);
				await page.locator('#t-close').click();
				return `${cols} columns, same session after leaving; shells: ${names.join(', ')}; ${second} next to PowerShell`;
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
