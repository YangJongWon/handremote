// handremote server: the phone UI (web/), the list of the PC's windows, widgets, tray icons
// and servers, and one WebSocket per window shown on the phone (frames out, input in).
//
//   phone ──https──> main listener (0.0.0.0:9100, token cookie)  ──┐
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
import { startTailscale } from './tailscale.mjs';
import { ensureCert, lanAddresses } from './tls.mjs';
import { acceptWebSocket } from './ws.mjs';
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
	const token = await loadToken(dataDir, opts.newToken);
	const linkSecret = crypto.randomBytes(24).toString('base64url');
	const agents = startAgents({ dataDir, log });
	const helper = helperClient({ pipe: HELPER_PIPE, secret: readHelperSecret, log });
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
		return { ok: true, api: API_VERSION, version: VERSION, host: os.hostname(), windows: wins.windows, tray: trayCache.items, servers: servers.servers, helper: helperInfo, linked: !!ctx.linked };
	}

	/** Which agent drives a window: elevated ones and the secure desktop (hwnd 0) need the helper. */
	function driverFor(hwnd, ctx) {
		const w = lastWindows.get(hwnd);
		const needsHelper = hwnd === 0 || !!w?.elevated;
		if (!needsHelper) return { frames: agents.frames, control: agents.control };
		if (!helperAllowed(ctx) || !helper.connected) return null;
		return { frames: helper, control: helper };
	}

	// ------------------------------------------------------------ the window viewer
	function view(ws, query, ctx) {
		const hwnd = Number(query.get('hwnd')) || 0;
		const drive = driverFor(hwnd, ctx);
		const viewOnly = !drive;
		const frames = drive?.frames || agents.frames; // elevated windows can still be seen without the helper
		const control = drive?.control || agents.control;
		let crc = 0;
		let stopped = false;
		let entry = null;
		const fit = query.get('fit') === '1' && hwnd !== 0;
		const size = { w: Math.max(200, Math.min(2000, Number(query.get('w')) || 390)), h: Math.max(200, Math.min(3000, Number(query.get('h')) || 760)) };
		const fail = (err) => ws.sendText({ t: 'error', code: err.code || null, msg: err.message });

		(async () => {
			try {
				entry = await acquire(hwnd, control, fit && !viewOnly ? size : null);
			} catch (err) {
				fail(err);
			}
			ws.sendText({ t: 'ready', viewOnly, fitted: !!entry?.fitted, helper: drive?.control === helper });
			tick();
		})();

		async function tick() {
			if (stopped) return;
			if (ws.backlog > 1 << 20) return setTimeout(tick, 80);
			try {
				const f = await frames.request('frame', { hwnd, q: quality, crc }, { timeout: 10000 });
				if (stopped) return;
				if (!f.same) {
					crc = f.crc;
					ws.sendText({ t: 'frame', w: f.w, h: f.h, desktop: f.desktop });
					ws.sendBinary(Buffer.from(f.jpeg, 'base64'));
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

		ws.on('message', async (text) => {
			let m;
			try {
				m = JSON.parse(text);
			} catch {
				return;
			}
			try {
				if (m.t === 'fit' || m.t === 'nofit') {
					if (viewOnly || hwnd === 0 || !entry) return;
					if (m.t === 'fit') await refit(hwnd, entry, { w: Number(m.w) || size.w, h: Number(m.h) || size.h });
					else await unfit(hwnd, entry);
					crc = 0;
					return ws.sendText({ t: 'fitted', fitted: entry.fitted });
				}
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
			stopped = true;
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
			if (p === '/api/list') return sendJson(res, 200, await list(ctx));
			if (p === '/api/state') return sendJson(res, 200, { ok: true, api: API_VERSION, version: VERSION, helper: await helperState(ctx) });
			if (p === '/api/icon') {
				const r = await agents.control.request('icon', { hwnd: Number(url.searchParams.get('hwnd')) || 0 });
				if (!r.png) return sendJson(res, 404, { ok: false });
				res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'private, max-age=300' });
				return res.end(Buffer.from(r.png, 'base64'));
			}
			if (p === '/api/proc') return sendJson(res, 200, await agents.control.request('proc', { pid: Number(url.searchParams.get('pid')) || 0 }));
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

	function appUpgrade(req, socket, head, ctx) {
		const url = new URL(req.url, 'http://x');
		if (url.pathname !== '/api/view') return socket.destroy();
		const ws = acceptWebSocket(req, socket, head);
		if (ws) view(ws, url.searchParams, ctx);
	}

	// ------------------------------------------------------------ main listener (standalone)
	const host = opts.local ? '127.0.0.1' : '0.0.0.0';
	const authed = (req) => sameSecret(cookies(req)[TOKEN_COOKIE], token);
	const forwarder = createPortForwarder({ authed, log });
	let tls = null;
	if (!opts.local) {
		const cert = await ensureCert(dataDir, lanAddresses().map((a) => a.ip));
		tls = { cert: cert.cert, key: cert.key };
	}
	let access = { links: [], local: `http://localhost:${opts.port}` };

	const mainHandler = async (req, res) => {
		const url = new URL(req.url, 'http://x');
		if (url.pathname === '/connect') {
			if (!isLoopback(req) || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return sendPage(res, 403, 'This page only opens on the PC itself.');
			return sendPage(res, 200, await connectHtml(access));
		}
		const tkn = url.searchParams.get('tkn');
		if (tkn) {
			if (!sameSecret(tkn, token)) return sendPage(res, 403, '이 링크는 더 이상 유효하지 않습니다. PC에서 새 링크를 받으세요.<br>This link is no longer valid.');
			url.searchParams.delete('tkn');
			res.writeHead(302, {
				'set-cookie': `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${tls || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`,
				location: url.pathname + (url.search || ''),
				'cache-control': 'no-store',
			});
			return res.end();
		}
		if (forwarder.handle(req, res)) return;
		if (!authed(req)) return sendPage(res, 403, 'PC에서 handremote가 보여 준 QR 코드나 링크로 여세요.<br>Open the QR code or link handremote shows on the PC.');
		return app(req, res, { linked: false });
	};
	const mainServer = tls ? https.createServer(tls, mainHandler) : http.createServer(mainHandler);
	mainServer.on('upgrade', (req, socket, head) => {
		if (forwarder.upgrade(req, socket, head)) return;
		if (!authed(req)) return socket.destroy();
		appUpgrade(req, socket, head, { linked: false });
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
