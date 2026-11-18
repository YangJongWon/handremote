// handremote server: the phone UI (web/), the list of the PC's windows, widgets, tray icons
// and servers, and one WebSocket per window shown on the phone (frames out, input in).
//
//   phone ──https──> main listener (0.0.0.0:9100, device cookie) ──┐
//   phone ──> handide ──> link listener (127.0.0.1:random, secret) ─┴─> app ──> agents (user)
//                                                                         └──> helper (SYSTEM, pipe)
import crypto from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { helperClient, startAgents } from './agent.mjs';
import { createPortForwarder } from './ports.mjs';
import { serverStatus } from './system.mjs';
import { startTailscale, tailscalePeer } from './tailscale.mjs';
import { installService, serviceState, startLoopSoon, uninstallService, underService } from './service.mjs';
import { ensureCert, lanAddresses } from './tls.mjs';
import { acceptWebSocket } from './ws.mjs';
import { watchDownloads } from './downloads.mjs';
import { handleFiles, localPath, uploaded } from './files.mjs';
import { createTerminals } from './term.mjs';
import { createDevices, DEVICE_COOKIE, PERMS } from './devices.mjs';
import { cableMicName, createCableInstaller } from './cable.mjs';

// xterm.js for the phone's terminal, from node_modules.
const VENDOR = {
	'/vendor/xterm.js': '@xterm/xterm/lib/xterm.js',
	'/vendor/xterm.css': '@xterm/xterm/css/xterm.css',
	'/vendor/addon-fit.js': '@xterm/addon-fit/lib/addon-fit.js',
};
import { HELPER_PIPE, readHelperSecret, helperInstalled } from './helper.mjs';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
export const API_VERSION = 1;
const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const TOKEN_COOKIE = 'hr-tkn';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

export const dataDirDefault = () => process.env.HANDREMOTE_HOME || join(os.homedir(), '.handremote');

const cookies = (req) => {
	const out = {};
	for (const part of (req.headers.cookie || '').split(';')) {
		const [k, ...v] = part.trim().split('=');
		if (k) out[k] = v.join('=');
	}
	return out;
};

const isLoopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
const sameSecret = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function sendJson(res, status, body) {
	res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
	res.end(JSON.stringify(body));
}

function sendPage(res, status, html) {
	res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
	res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>handremote</title><body style="font:16px/1.6 system-ui,sans-serif;padding:24px;max-width:36em;margin:auto">${html}</body>`);
}

async function readBody(req, limit = 64 << 10) {
	let size = 0;
	const chunks = [];
	for await (const c of req) {
		size += c.length;
		if (size > limit) throw new Error('body too large');
		chunks.push(c);
	}
	return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

async function loadToken(dataDir, renew) {
	const file = join(dataDir, 'token');
	if (!renew) {
		try {
			const t = (await readFile(file, 'utf8')).trim();
			if (t.length >= 32) return t;
		} catch {}
	}
	const t = crypto.randomBytes(24).toString('base64url');
	await writeFile(file, t, { mode: 0o600 });
	return t;
}

async function loadConfig(dataDir) {
	try {
		return JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8'));
	} catch {
		return {};
	}
}

export async function startServer(opts) {
	const log = opts.log || ((m) => console.log(`[handremote] ${m}`));
	const dataDir = opts.dataDir || dataDirDefault();
	await mkdir(dataDir, { recursive: true });
	const config = await loadConfig(dataDir);
	let token = await loadToken(dataDir, opts.newToken);
	const devices = createDevices({ dataDir, log });
	const startedAt = Date.now();
	const cable = createCableInstaller({ dataDir, log });
	let remoteInfo = { reason: opts.local ? 'this PC only (--local)' : opts.remote === false ? 'off (--no-remote)' : 'starting' };
	const streams = new Map(); // ws → what each open window view sends now, for the diagnosis
	const linkSecret = crypto.randomBytes(24).toString('base64url');
	const agents = startAgents({ dataDir, log });
	const helper = helperClient({ pipe: HELPER_PIPE, secret: readHelperSecret, log });
	const downloads = watchDownloads({ log, ignore: (path) => uploaded.has(path.toLowerCase()) });
	const terminals = createTerminals({ cacheDir: join(dataDir, 'cache'), log });
	const quality = Number(config.quality) || 70;

	// ------------------------------------------------------------ fitted windows
	// Every window laid out for a phone is written down first, so it gets its size back
	// when the last phone stops showing it, on exit, or on the next start after a crash.
	const restoreFile = join(dataDir, 'restore.json');
	const fitted = new Map(); // hwnd → { count, saved, fitted, via }
	const persist = () => {
		const out = {};
		for (const [hwnd, f] of fitted) if (f.fitted) out[hwnd] = { saved: f.saved, via: f.via === helper ? 'helper' : 'user' };
		try {
			writeFileSync(restoreFile, JSON.stringify(out));
		} catch {}
	};
	const restoreLeftovers = async () => {
		let left = {};
		try {
			left = JSON.parse(readFileSync(restoreFile, 'utf8'));
		} catch {
			return;
		}
		for (const [hwnd, f] of Object.entries(left)) {
			const via = f.via === 'helper' ? helper : agents.control;
			await via.request('restore', { hwnd: Number(hwnd), saved: f.saved }).catch(() => {});
		}
		persist();
		if (Object.keys(left).length) log(`gave ${Object.keys(left).length} window(s) their size back from the last run`);
	};
	restoreLeftovers();

	async function acquire(hwnd, via, size) {
		let f = fitted.get(hwnd);
		if (!f) {
			f = { count: 0, saved: null, fitted: false, via };
			fitted.set(hwnd, f);
		}
		f.count++;
		if (size) await refit(hwnd, f, size);
		return f;
	}

	async function refit(hwnd, f, size) {
		const res = await f.via.request('fit', { hwnd, w: size.w, h: size.h }, { urgent: true });
		if (!f.fitted) f.saved = res.saved;
		f.fitted = true;
		persist();
		return res;
	}

	async function unfit(hwnd, f) {
		if (!f.fitted) return;
		f.fitted = false;
		persist();
		await f.via.request('restore', { hwnd, saved: f.saved }, { urgent: true }).catch(() => {});
	}

	async function release(hwnd) {
		const f = fitted.get(hwnd);
		if (!f || --f.count > 0) return;
		fitted.delete(hwnd);
		await unfit(hwnd, f);
	}

	// ------------------------------------------------------------ state
	let lastWindows = new Map(); // hwnd → window, from the last list
	let trayCache = { at: 0, items: [] };

	/** Whether this request may use the SYSTEM helper (never through a public link). */
	const helperAllowed = (ctx) => !(ctx.linked && /^(public|cloudflare)$/.test(ctx.remoteMode || '') && !config.helperOnPublic);

	async function helperState(ctx) {
		const installed = helperInstalled();
		if (!installed) return { installed: false };
		if (!helperAllowed(ctx)) return { installed: true, allowed: false };
		const connected = helper.connected || (await helper.connect());
		if (!connected) return { installed: true, allowed: true, connected: false };
		const d = await helper.request('desktop', {}, { timeout: 3000 }).catch(() => null);
		return { installed: true, allowed: true, connected: true, desktop: d?.desktop || null, secure: !!d && d.desktop !== 'Default' };
	}

	async function list(ctx) {
		const [wins, tray, servers, helperInfo] = await Promise.all([
			agents.control.request('list'),
			Date.now() - trayCache.at < 5000
				? trayCache
				: agents.control.request('tray').then((t) => (trayCache = { at: Date.now(), items: t.items })).catch(() => trayCache),
			serverStatus({ ownPorts: [opts.port, linkPort], agent: agents.frames }),
			helperState(ctx),
		]);
		const helperOk = helperInfo.connected;
		lastWindows = new Map(wins.windows.map((w) => [w.hwnd, w]));
		for (const w of wins.windows) w.viewOnly = w.elevated && !helperOk;
		return { ok: true, api: API_VERSION, version: VERSION, now: Date.now(), downloads: downloads.recent(), host: os.hostname(), windows: wins.windows, tray: trayCache.items, servers: servers.servers, helper: helperInfo, linked: !!ctx.linked };
	}

	/** Which agent drives a window: elevated ones and the secure desktop (hwnd 0) need the helper. */
	function driverFor(hwnd, ctx) {
		const w = lastWindows.get(hwnd);
		const needsHelper = hwnd === 0 || !!w?.elevated;
		if (!needsHelper) return { frames: agents.frames, control: agents.control };
		if (!helperAllowed(ctx) || !helper.connected) return null;
		return { frames: helper, control: helper };
	}

	let soundOwner = null; // the viewer whose sound the PC captures now
	let micOwner = null; // the viewer whose microphone the PC plays into the cable

	// ------------------------------------------------------------ the window viewer
	function view(ws, query, ctx) {
		const hwnd = Number(query.get('hwnd')) || 0;
		const drive = driverFor(hwnd, ctx);
		const noControl = !can(ctx, 'control'); // this phone may only look
		const viewOnly = !drive || noControl;
		const frames = drive?.frames || agents.frames; // elevated windows can still be seen without the helper
		const control = drive?.control || agents.control;
		let crc = 0;
		let popupSent = 0;
		let stopped = false;
		let entry = null;
		const fit = query.get('fit') === '1' && hwnd !== 0;
		const size = { w: Math.max(200, Math.min(2000, Number(query.get('w')) || 390)), h: Math.max(200, Math.min(3000, Number(query.get('h')) || 760)) };
		// The phone's width in device pixels: nothing wider is sent.
		const maxw = Math.round(size.w * Math.max(1, Math.min(4, Number(query.get('dpr')) || 2)));
		// Quality and size follow the network. The phone acknowledges each frame it shows
		// (?ack=1): frames still on their way lower quality, then size, and stop new captures
		// until the phone catches up (no seconds-old picture on a slow link); a run of frames
		// that arrive right away raises them again. The socket's own backlog is a fallback.
		const acks = query.get('ack') === '1';
		let q = quality;
		let scale = 1;
		let smooth = 0;
		let lastSent = Date.now();
		let sentN = 0;
		let ackN = 0;
		let lowered = 0;
		const inflight = () => (acks ? sentN - ackN : ws.backlog > 384 << 10 ? 3 : 0);
		const adapt = () => {
			const n = inflight();
			if (n >= 2 && Date.now() - lowered > 800) {
				lowered = Date.now();
				smooth = 0;
				if (q > 40) q = Math.max(40, q - 15);
				else scale = Math.max(0.4, +(scale - 0.2).toFixed(2));
			} else if (n === 0 && ++smooth >= 12) {
				smooth = 0;
				if (scale < 1) scale = Math.min(1, +(scale + 0.1).toFixed(2));
				else if (q < quality) q = Math.min(quality, q + 5);
			}
		};
		const fail = (err) => ws.sendText({ t: 'error', code: err.code || null, msg: err.message });
		const stat = { hwnd, q, scale, inflight: 0, sent: [] };
		streams.set(ws, stat);

		// Sound for this viewer: off, this window's program, or the whole PC. One capture at a
		// time on the PC: the viewer that set it last owns it. Sent as binary messages tagged
		// "A" (the frames are JPEG, which start with 0xFF).
		let soundMode = 'off';
		let soundTimer = null;
		const TAG = Buffer.from('A');
		async function setSound(mode) {
			soundMode = ['window', 'all'].includes(mode) ? mode : 'off';
			clearInterval(soundTimer);
			soundTimer = null;
			soundOwner = ws;
			const pid = lastWindows.get(hwnd)?.pid || 0;
			const r = await agents.sound.request('sound', { mode: soundMode === 'window' && !pid ? 'off' : soundMode, pid }, { urgent: true, timeout: 8000 });
			ws.sendText({ t: 'sound', mode: r.mode, error: r.error || null });
			if (r.mode === 'off' || stopped) return;
			soundTimer = setInterval(async () => {
				if (stopped || soundOwner !== ws) return clearInterval(soundTimer);
				try {
					const s = await agents.sound.request('soundRead', {}, { timeout: 3000 });
					if (s.pcm && ws.backlog < 1 << 20) ws.sendBinary(Buffer.concat([TAG, Buffer.from(s.pcm, 'base64')]));
					if (s.error) ws.sendText({ t: 'sound', mode: 'off', error: s.error });
				} catch {}
			}, 80);
		}

		// Something copied on the PC: the phone is told, and may take it (api/clipboard).
		let clipSeq = null;
		const clipTimer = noControl
			? null
			: setInterval(async () => {
					if (stopped) return;
					try {
						const { seq } = await agents.control.request('clipSeq', {}, { timeout: 3000 });
						if (clipSeq != null && seq !== clipSeq) {
							const r = await agents.control.request('clipGet', {}, { timeout: 3000 });
							if (r.text) ws.sendText({ t: 'clip', seq, chars: r.text.length, preview: r.text.slice(0, 60) });
						}
						clipSeq = seq;
					} catch {}
				}, 1500);

		(async () => {
			try {
				entry = await acquire(hwnd, control, fit && !viewOnly ? size : null);
			} catch (err) {
				fail(err);
			}
			ws.sendText({ t: 'ready', viewOnly, noControl, fitted: !!entry?.fitted, helper: drive?.control === helper });
			tick();
		})();

		async function tick() {
			if (stopped) return;
			if (ws.backlog > 1 << 20 || inflight() >= 3) {
				adapt();
				return setTimeout(tick, 60);
			}
			try {
				const f = await frames.request('frame', { hwnd, q, crc, scale, maxw }, { timeout: 10000 });
				if (stopped) return;
				if (f.popup && f.popup !== popupSent) ws.sendText({ t: 'popup', hwnd: f.popup, title: f.popupTitle || '' });
				popupSent = f.popup || 0;
				if (!f.same) {
					crc = f.crc;
					ws.sendText({ t: 'frame', n: ++sentN, w: f.w, h: f.h, desktop: f.desktop, q, scale: f.sw ? +(f.sw / f.w).toFixed(2) : 1 });
					ws.sendBinary(Buffer.from(f.jpeg, 'base64'));
					lastSent = Date.now();
					adapt();
					stat.sent.push(lastSent);
					if (stat.sent.length > 30) stat.sent.shift();
					Object.assign(stat, { q, scale, inflight: inflight(), bytes: f.jpeg.length * 0.75 });
				} else if (Date.now() - lastSent > 5000) {
					// Nothing changed for a while: still a sign of life for the phone's watchdog.
					ws.sendText({ t: 'alive' });
					lastSent = Date.now();
				}
				setTimeout(tick, f.same ? 120 : 50);
			} catch (err) {
				if (stopped) return;
				if (/window closed/.test(err.message)) {
					ws.sendText({ t: 'gone' });
					return ws.close();
				}
				fail(err);
				setTimeout(tick, 1000);
			}
		}

		// The phone's microphone: on/off as text, then binary messages tagged "M" (24 kHz mono
		// 16-bit) played into the virtual cable. One phone at a time, like the sound.
		async function setMic(on) {
			try {
				const r = await agents.sound.request('mic', { on: !!on }, { urgent: true, timeout: 8000 });
				micOwner = on ? ws : micOwner === ws ? null : micOwner;
				ws.sendText({ t: 'mic', on: !!on, device: r.device || null, pick: cableMicName(r.device) });
			} catch (err) {
				if (micOwner === ws) micOwner = null;
				ws.sendText({ t: 'mic', on: false, error: err.code || 'error', msg: err.message });
			}
		}
		let micBusy = false;
		ws.on('binary', (buf) => {
			if (buf[0] !== 0x4d || micOwner !== ws || micBusy) return; // a late chunk is dropped, not queued
			micBusy = true;
			agents.sound
				.request('micWrite', { pcm: buf.subarray(1).toString('base64') }, { timeout: 2000 })
				.catch(() => {})
				.finally(() => (micBusy = false));
		});

		ws.on('message', async (text) => {
			let m;
			try {
				m = JSON.parse(text);
			} catch {
				return;
			}
			try {
				if (m.t === 'ack') return void (ackN = Math.max(ackN, Number(m.n) || 0));
				if (m.t === 'fit' || m.t === 'nofit') {
					if (viewOnly || hwnd === 0 || !entry) return;
					if (m.t === 'fit') await refit(hwnd, entry, { w: Number(m.w) || size.w, h: Number(m.h) || size.h });
					else await unfit(hwnd, entry);
					crc = 0;
					return ws.sendText({ t: 'fitted', fitted: entry.fitted });
				}
				if (m.t === 'sound') return await setSound(String(m.mode || 'off'));
				if (noControl) return ws.sendText({ t: 'error', code: 'perm-control', msg: 'this device may only look' });
				if (m.t === 'mic') return await setMic(!!m.on);
				if (viewOnly) return ws.sendText({ t: 'error', code: 'view-only', msg: 'view only' });
				const urgent = { urgent: true };
				if (m.t === 'mouse') await control.request('mouse', { hwnd, t: String(m.a), fx: Number(m.fx), fy: Number(m.fy), dy: Math.round(Number(m.dy) || 0), dx: Math.round(Number(m.dx) || 0) }, urgent);
				else if (m.t === 'text') await control.request('text', { hwnd, s: String(m.s).slice(0, 4000) }, urgent);
				else if (m.t === 'key') await control.request('key', { hwnd, vk: Number(m.vk) | 0, mods: String(m.mods || '') }, urgent);
				else if (m.t === 'sas') await helper.request('sas', {}, urgent);
			} catch (err) {
				fail(err);
			}
		});

		ws.on('close', () => {
			clearInterval(clipTimer);
			streams.delete(ws);
			stopped = true;
			clearInterval(soundTimer);
			if (soundOwner === ws) {
				soundOwner = null;
				agents.sound.request('sound', { mode: 'off' }).catch(() => {});
			}
			if (micOwner === ws) {
				micOwner = null;
				agents.sound.request('mic', { on: false }).catch(() => {});
			}
			if (entry) release(hwnd);
		});
	}

	// ------------------------------------------------------------ routes
	async function app(req, res, ctx) {
		const url = new URL(req.url, 'http://x');
		const p = url.pathname;
		try {
			if (req.method === 'GET' && (p === '/' || /^\/(app\.js|app\.css|icon\.svg|manifest\.json)$/.test(p))) {
				const file = join(WEB, p === '/' ? 'index.html' : p.slice(1));
				res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
				return res.end(await readFile(file));
			}
			if (req.method === 'GET' && VENDOR[p]) {
				const file = fileURLToPath(new URL(`../node_modules/${VENDOR[p]}`, import.meta.url));
				res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'public, max-age=86400' });
				return res.end(await readFile(file));
			}
			if (p === '/api/ping') return sendJson(res, 200, { ok: true, t: Date.now() });
			if (p === '/api/diag') return sendJson(res, 200, await diagnose(req, ctx));
			if (p === '/api/diag/speed') return await speedTest(req, res, url);
			if (p === '/api/service' && req.method === 'POST') return await serviceApi(req, res, ctx);
			if (p === '/api/mic/install') {
				// Getting the virtual cable (cable.mjs): installing a driver is the PC owner's call.
				if (!can(ctx, 'admin') || !can(ctx, 'control')) return sendJson(res, 403, { ok: false, error: 'not allowed on this device (admin)', code: 'perm-admin' });
				if (req.method === 'POST') return sendJson(res, 200, { ok: true, ...cable.start(!!(await readBody(req)).dry) });
				return sendJson(res, 200, { ok: true, ...cable.state() });
			}
			if (p === '/api/me') return sendJson(res, 200, { ok: true, linked: !!ctx.linked, device: ctx.device ? { id: ctx.device.id, name: ctx.device.name } : null, perms: Object.fromEntries(PERMS.map((k) => [k, can(ctx, k)])) });
			if (p.startsWith('/api/devices')) return await devicesApi(req, res, p, ctx);
			// What each permission covers; looking (the list, the windows, the sound) is everyone's.
			const need = /^\/api\/term\b/.test(p) ? 'term' : /^\/api\/files?\b/.test(p) ? 'files' : /^\/api\/(close|tray|download\/open|clipboard)$/.test(p) ? 'control' : null;
			if (need && !can(ctx, need)) return sendJson(res, 403, { ok: false, error: `not allowed on this device (${need})`, code: `perm-${need}` });
			if (p === '/api/clipboard') {
				// The PC's clipboard as text: to the phone (GET), or from it (POST).
				if (req.method === 'POST') {
					const body = await readBody(req, 2 << 20);
					return sendJson(res, 200, { ok: true, ...(await agents.control.request('clipSet', { text: String(body.text ?? '') }, { urgent: true })) });
				}
				const r = await agents.control.request('clipGet', {}, { urgent: true });
				return sendJson(res, 200, { ok: true, seq: r.seq, text: r.text || '' });
			}
			if (p === '/api/term/list') return sendJson(res, 200, { ok: true, ...(await terminals.list()) });
			if (p === '/api/list') return sendJson(res, 200, await list(ctx));
			if (p === '/api/state') return sendJson(res, 200, { ok: true, api: API_VERSION, version: VERSION, now: Date.now(), downloads: downloads.recent(), helper: await helperState(ctx) });
			if (await handleFiles(req, res, url, sendJson)) return;
			if (p === '/api/files/open' && req.method === 'POST') {
				const body = await readBody(req);
				const path = localPath(body.path);
				if (!path) return sendJson(res, 400, { ok: false, error: 'not a local path' });
				await agents.control.request('open', { path, folder: body.how === 'folder' }, { urgent: true });
				return sendJson(res, 200, { ok: true });
			}
			if (p === '/api/download/open' && req.method === 'POST') {
				// Only a download this server saw finish, by its id: never a path from the phone.
				const body = await readBody(req);
				const d = downloads.get(Number(body.id));
				if (!d) return sendJson(res, 404, { ok: false, error: 'not found' });
				await agents.control.request('open', { path: d.path, folder: body.how === 'folder' }, { urgent: true });
				return sendJson(res, 200, { ok: true });
			}
			if (p === '/api/icon') {
				const r = await agents.control.request('icon', { hwnd: Number(url.searchParams.get('hwnd')) || 0 });
				if (!r.png) return sendJson(res, 404, { ok: false });
				res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'private, max-age=300' });
				return res.end(Buffer.from(r.png, 'base64'));
			}
			if (p === '/api/proc') return sendJson(res, 200, await agents.control.request('proc', { pid: Number(url.searchParams.get('pid')) || 0 }));
			if (p === '/api/close' && req.method === 'POST') {
				// Only windows from the last list, each through the agent allowed to drive it.
				const body = await readBody(req);
				const hwnds = [...new Set((Array.isArray(body.hwnds) ? body.hwnds : []).map(Number))].filter((h) => h > 0 && lastWindows.has(h)).slice(0, 100);
				let closed = 0;
				const failed = [];
				for (const hwnd of hwnds) {
					const drive = driverFor(hwnd, ctx);
					if (!drive) {
						failed.push({ hwnd, code: 'view-only' });
						continue;
					}
					try {
						if ((await drive.control.request('close', { hwnd }, { urgent: true })).sent) closed++;
						else failed.push({ hwnd, code: 'refused' });
					} catch (err) {
						failed.push({ hwnd, code: err.code || 'error' });
					}
				}
				return sendJson(res, 200, { ok: true, closed, failed });
			}
			if (p === '/api/tray' && req.method === 'POST') {
				const body = await readBody(req);
				trayCache.at = 0;
				return sendJson(res, 200, await agents.control.request('trayClick', { item: String(body.item || ''), button: body.button === 'right' ? 'right' : 'left' }, { urgent: true }));
			}
			return sendJson(res, 404, { ok: false, error: 'not found' });
		} catch (err) {
			return sendJson(res, 500, { ok: false, error: err.message, code: err.code || null });
		}
	}

	// ------------------------------------------------------------ connection diagnosis
	// What the phone's "connection" screen shows: the path it came in on (same Wi-Fi,
	// Tailscale direct or relayed, handide), whether each part on the PC answers, the
	// streams being sent, the away-from-home link and whether handremote starts at logon.
	function pathOf(req, ctx) {
		if (ctx.linked) return { kind: 'handide' };
		const raw = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
		const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
		const loop = isLoopback(req);
		const ip = loop && fwd ? fwd : raw;
		if (loop && !fwd) return { kind: 'local', ip };
		if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) || /^fd7a:115c:a1e0:/i.test(ip)) return { kind: 'tailscale', ip, served: loop };
		return { kind: 'lan', ip };
	}

	async function diagnose(req, ctx) {
		const ping = async (name, agent) => {
			const t0 = Date.now();
			try {
				await agent.request('hello', {}, { timeout: 4000 });
				return { name, ok: true, ms: Date.now() - t0 };
			} catch (err) {
				return { name, ok: false, error: err.message };
			}
		};
		const path = pathOf(req, ctx);
		if (path.kind === 'tailscale') path.peer = await tailscalePeer(path.ip).catch(() => null);
		const now = Date.now();
		return {
			ok: true,
			version: VERSION,
			host: os.hostname(),
			uptime: now - startedAt,
			path,
			tls: !!tls,
			agents: await Promise.all([ping('frames', agents.frames), ping('control', agents.control), ping('sound', agents.sound)]),
			helper: await helperState(ctx),
			remote: remoteInfo,
			service: serviceState(),
			devices: devices.list().length,
			streams: [...streams.values()].map((s) => ({
				hwnd: s.hwnd,
				q: s.q,
				scale: s.scale,
				inflight: s.inflight,
				fps: +(s.sent.filter((t) => now - t < 5000).length / 5).toFixed(1),
				kb: Math.round((s.bytes || 0) / 1024),
			})),
		};
	}

	/** GET: ?kb= random bytes to time the way down. POST: the body is read and timed. */
	async function speedTest(req, res, url) {
		if (req.method === 'POST') {
			const t0 = Date.now();
			let bytes = 0;
			for await (const c of req) {
				bytes += c.length;
				if (bytes > 8 << 20) break;
			}
			return sendJson(res, 200, { ok: true, bytes, ms: Date.now() - t0 });
		}
		const kb = Math.max(16, Math.min(4096, Number(url.searchParams.get('kb')) || 512));
		res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': kb * 1024, 'cache-control': 'no-store' });
		res.end(crypto.randomBytes(kb * 1024));
	}

	/** Start at logon on/off, from an admin phone. */
	async function serviceApi(req, res, ctx) {
		if (!can(ctx, 'admin')) return sendJson(res, 403, { ok: false, error: 'not allowed on this device (admin)', code: 'perm-admin' });
		const body = await readBody(req);
		if (body.on) {
			await installService({ args: process.argv.slice(2), dataDir, log, start: false });
			// Run by hand now: hand over to the loop (this one exits, the loop's starts).
			const handover = !underService() && startLoopSoon(3);
			sendJson(res, 200, { ok: true, service: serviceState(), handover });
			if (handover) setTimeout(() => shutdown(), 500);
			return;
		}
		await uninstallService({ log, stop: false });
		return sendJson(res, 200, { ok: true, service: serviceState() });
	}

	// ------------------------------------------------------------ devices and permissions
	const can = (ctx, perm) => !!ctx?.linked || !!ctx?.device?.perms?.[perm]; // handide's own token is the owner's
	const sockets = new Map(); // ws → device id: a device changed or removed loses its open views
	devices.onChange((id) => {
		for (const [ws, dev] of sockets) if (dev === id) ws.close();
	});
	const pcLink = () => (access.links[0]?.url || access.local).replace(/\?.*$/, '');

	async function devicesApi(req, res, p, ctx) {
		if (!can(ctx, 'admin')) return sendJson(res, 403, { ok: false, error: 'not allowed on this device (admin)', code: 'perm-admin' });
		if (p === '/api/devices' && req.method === 'GET') return sendJson(res, 200, { ok: true, me: ctx.device?.id || null, devices: devices.list(), perms: PERMS });
		if (req.method !== 'POST') return sendJson(res, 404, { ok: false, error: 'not found' });
		const body = await readBody(req);
		try {
			if (p === '/api/devices/update') return sendJson(res, 200, { ok: true, device: devices.update(String(body.id), { name: body.name, perms: body.perms }) });
			if (p === '/api/devices/remove') return (devices.remove(String(body.id)), sendJson(res, 200, { ok: true }));
		} catch (err) {
			return sendJson(res, err.code === 'not-found' ? 404 : 409, { ok: false, error: err.message, code: err.code });
		}
		if (p === '/api/devices/invite') {
			const inv = devices.invite(body.perms || {}, body.name);
			const url = `${pcLink()}?inv=${inv.code}`;
			return sendJson(res, 200, { ok: true, url, expires: inv.expires, qr: await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }) });
		}
		if (p === '/api/devices/rotate') {
			// A new PC link: the old QR codes and links stop pairing; paired devices stay.
			const old = token;
			token = await loadToken(dataDir, true);
			const swap = (u) => u.replace(`tkn=${encodeURIComponent(old)}`, `tkn=${encodeURIComponent(token)}`);
			access = { ...access, local: swap(access.local), links: access.links.map((l) => ({ ...l, url: swap(l.url) })) };
			log('the PC link was replaced: the old one no longer pairs');
			printAccess(access, log).catch(() => {});
			return sendJson(res, 200, { ok: true });
		}
		return sendJson(res, 404, { ok: false, error: 'not found' });
	}

	function appUpgrade(req, socket, head, ctx) {
		const url = new URL(req.url, 'http://x');
		if (url.pathname !== '/api/view' && url.pathname !== '/api/term') return socket.destroy();
		if (url.pathname === '/api/term' && !can(ctx, 'term')) return socket.destroy();
		const ws = acceptWebSocket(req, socket, head);
		if (!ws) return;
		if (ctx.device) {
			sockets.set(ws, ctx.device.id);
			ws.on('close', () => sockets.delete(ws));
		}
		if (url.pathname === '/api/term') terminals.attach(ws, url.searchParams);
		else view(ws, url.searchParams, ctx);
	}

	// ------------------------------------------------------------ main listener (standalone)
	const host = opts.local ? '127.0.0.1' : '0.0.0.0';
	// Who is asking: the device of its cookie. A phone paired before devices existed (the
	// shared token cookie) becomes a device on its next page load.
	const deviceOf = (req) => devices.fromCookie(cookies(req)[DEVICE_COOKIE]);
	const legacy = (req) => sameSecret(cookies(req)[TOKEN_COOKIE], token);
	const forwarder = createPortForwarder({ authed: (req) => can({ device: deviceOf(req) }, 'control'), log });
	let tls = null;
	if (!opts.local) {
		const cert = await ensureCert(dataDir, lanAddresses().map((a) => a.ip));
		tls = { cert: cert.cert, key: cert.key };
	}
	let access = { links: [], local: `http://localhost:${opts.port}` };
	const secure = (req) => (tls || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '');
	const deviceCookie = (req, value) => `${DEVICE_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure(req)}`;
	const dropLegacy = (req) => `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(req)}`;
	const paired = (req, res, url, pair) => {
		url.searchParams.delete('tkn');
		url.searchParams.delete('inv');
		res.writeHead(302, { 'set-cookie': [deviceCookie(req, pair.cookie), dropLegacy(req)], location: url.pathname + (url.search || ''), 'cache-control': 'no-store' });
		return res.end();
	};

	const mainHandler = async (req, res) => {
		const url = new URL(req.url, 'http://x');
		if (url.pathname === '/connect') {
			if (!isLoopback(req) || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return sendPage(res, 403, 'This page only opens on the PC itself.');
			return sendPage(res, 200, await connectHtml(access));
		}
		const inv = url.searchParams.get('inv');
		if (inv) {
			const pair = devices.redeem(req, inv);
			if (!pair) return sendPage(res, 403, '초대 링크가 만료되었거나 이미 사용되었습니다. 새 초대를 받으세요.<br>This invite has expired or was already used.');
			return paired(req, res, url, pair);
		}
		const tkn = url.searchParams.get('tkn');
		if (tkn) {
			if (!sameSecret(tkn, token)) return sendPage(res, 403, '이 링크는 더 이상 유효하지 않습니다. PC에서 새 링크를 받으세요.<br>This link is no longer valid.');
			if (deviceOf(req)) {
				// Already paired (a bookmark with the link in it): no second device.
				url.searchParams.delete('tkn');
				res.writeHead(302, { location: url.pathname + (url.search || ''), 'cache-control': 'no-store' });
				return res.end();
			}
			return paired(req, res, url, devices.pairOwner(req));
		}
		if (forwarder.handle(req, res)) return;
		let device = deviceOf(req);
		if (!device && legacy(req)) {
			const pair = devices.pairOwner(req);
			device = pair.device;
			res.setHeader('set-cookie', [deviceCookie(req, pair.cookie), dropLegacy(req)]);
		}
		if (!device) {
			const was = cookies(req)[DEVICE_COOKIE];
			return sendPage(res, 403, was ? '이 기기는 연결이 해제되었습니다. 다시 쓰려면 PC의 QR 코드나 새 초대 링크로 여세요.<br>This device was removed. Open the PC\'s QR code or a new invite to use it again.' : 'PC에서 handremote가 보여 준 QR 코드나 링크로 여세요.<br>Open the QR code or link handremote shows on the PC.');
		}
		return app(req, res, { linked: false, device });
	};
	const mainServer = tls ? https.createServer(tls, mainHandler) : http.createServer(mainHandler);
	mainServer.on('upgrade', (req, socket, head) => {
		if (forwarder.upgrade(req, socket, head)) return;
		const device = deviceOf(req);
		if (!device) return socket.destroy();
		appUpgrade(req, socket, head, { linked: false, device });
	});
	// http:// on the same port is sent to https:// (a TLS handshake starts with 0x16).
	const front = tls
		? net.createServer((socket) => {
				socket.on('error', () => socket.destroy());
				socket.once('data', (first) => {
					socket.pause();
					socket.unshift(first);
					if (first[0] === 0x16) mainServer.emit('connection', socket);
					else redirect.emit('connection', socket);
					process.nextTick(() => socket.resume());
				});
			})
		: mainServer;
	const redirect = http.createServer((req, res) => {
		if (req.url.startsWith('/connect')) return mainHandler(req, res);
		res.writeHead(301, { location: `https://${req.headers.host}${req.url}` }).end();
	});

	// ------------------------------------------------------------ link listener (handide)
	const linkCtx = (req) => ({ linked: true, remoteMode: String(req.headers['x-handremote-remote'] || '') });
	const linkAuthed = (req) => isLoopback(req) && sameSecret(req.headers['x-handremote-secret'], linkSecret);
	const linkServer = http.createServer((req, res) => {
		if (!linkAuthed(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
		app(req, res, linkCtx(req));
	});
	linkServer.on('upgrade', (req, socket, head) => {
		if (!linkAuthed(req)) return socket.destroy();
		appUpgrade(req, socket, head, linkCtx(req));
	});
	let linkPort = 0;
	const endpointFile = join(dataDir, 'endpoint.json');
	await new Promise((resolve) => linkServer.listen(0, '127.0.0.1', resolve));
	linkPort = linkServer.address().port;
	writeFileSync(endpointFile, JSON.stringify({ api: API_VERSION, version: VERSION, port: linkPort, secret: linkSecret, pid: process.pid }), { mode: 0o600 });

	// ------------------------------------------------------------ start
	let stopRemote = null;
	await new Promise((resolve, reject) => {
		front.once('error', reject);
		front.listen(opts.port, host, resolve);
	}).catch((err) => {
		if (err.code === 'EADDRINUSE') throw new Error(`port ${opts.port} is in use (another handremote?). Stop it or pass --port <n>.`);
		throw err;
	});
	const path = `/?tkn=${encodeURIComponent(token)}`;
	const scheme = tls ? 'https' : 'http';
	access = {
		local: `${scheme}://localhost:${opts.port}${path}`,
		links: opts.local ? [] : lanAddresses().map((a) => ({ label: a.tailscale ? 'Tailscale IP' : a.name, url: `${scheme}://${a.ip}:${opts.port}${path}` })),
	};
	log(`ready on port ${opts.port}${opts.local ? ' (this PC only)' : ''}; handide link on 127.0.0.1:${linkPort}`);
	if (!opts.local && opts.remote !== false) {
		const r = await startTailscale({ port: opts.port, httpsPort: opts.tsPort || 9443, tls, log });
		remoteInfo = r.url ? { url: r.url } : { reason: r.reason };
		if (r.url) {
			stopRemote = r.stop;
			// The ts.net name supersedes the raw tailnet address.
			access.links = [{ label: 'Tailscale (anywhere, your devices)', url: `${r.url}${path}`, remote: true }, ...access.links.filter((l) => !/^Tailscale/.test(l.label))];
		} else log(`away-from-home link not available: ${r.reason}`);
	}
	await printAccess(access, log);

	let closed = false;
	const cleanup = () => {
		if (closed) return;
		closed = true;
		// Every window still laid out for a phone gets its size back.
		for (const [hwnd, f] of fitted) if (f.fitted) f.via.request('restore', { hwnd, saved: f.saved }).catch(() => {});
		terminals.stopAll();
		devices.stop();
		try {
			if (JSON.parse(readFileSync(endpointFile, 'utf8')).pid === process.pid) unlinkSync(endpointFile);
		} catch {}
		stopRemote?.();
	};
	const shutdown = async () => {
		cleanup();
		await new Promise((r) => setTimeout(r, 600)); // let the restores reach the agent
		agents.stop();
		process.exit(0);
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
	process.on('exit', () => {
		cleanup();
		agents.stop();
	});
	return { port: opts.port, linkPort, token, access, close: shutdown };
}

async function printAccess(access, log) {
	const best = access.links[0]?.url || access.local;
	console.log(await QRCode.toString(best, { type: 'terminal', small: true }));
	for (const l of access.links) log(`${l.label}: ${l.url}`);
	if (!access.links.length) log(`open: ${access.local}`);
}

async function connectHtml(access) {
	const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	const items = access.links.length ? access.links : [{ label: 'this PC', url: access.local }];
	const qrs = await Promise.all(items.map((l) => QRCode.toString(l.url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })));
	return `<h1 style="font-size:22px">handremote</h1><p>폰 카메라로 QR을 찍으세요. 링크는 이 PC를 여는 열쇠입니다.</p>${items
		.map((l, i) => `<h2 style="font-size:16px">${esc(l.label)}</h2><div style="max-width:320px">${qrs[i]}</div><p><code style="word-break:break-all">${esc(l.url)}</code></p>`)
		.join('')}`;
}
