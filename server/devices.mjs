// The phones allowed in, each with its own key and its own permissions. Opening the PC's
// link (the QR code) pairs a phone as a full device; an invite made on a phone with the
// "admin" permission pairs one with the permissions picked there, once, within minutes.
// Each device keeps a cookie "hr-dev=<id>.<secret>"; only the secret's hash is written down
// (devices.json, reread when it changes, so "handremote devices remove" works while running).
import crypto from 'node:crypto';
import { readFileSync, unwatchFile, watchFile, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PERMS = ['control', 'files', 'term', 'admin'];
export const DEVICE_COOKIE = 'hr-dev';
const INVITE_MS = 10 * 60 * 1000;

const hash = (s) => crypto.createHash('sha256').update(s).digest('base64url');
const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cleanPerms = (p = {}) => Object.fromEntries(PERMS.map((k) => [k, !!p[k]]));

/** "iPhone · Safari", "Pixel 7 · Chrome", "Windows · Edge" from a user agent. */
export function deviceName(ua = '') {
	const model =
		/iPhone/.test(ua) ? 'iPhone'
		: /iPad/.test(ua) ? 'iPad'
		: /Android/.test(ua) ? (ua.match(/Android [\d.]+; (?:[^;)]*; )?([^;)]+?)(?: Build|\))/)?.[1] || 'Android').trim()
		: /Windows/.test(ua) ? 'Windows'
		: /Macintosh/.test(ua) ? 'Mac'
		: /Linux/.test(ua) ? 'Linux'
		: 'Device';
	const browser =
		/Whale\//.test(ua) ? 'Whale'
		: /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
		: /Edg(A|iOS)?\//.test(ua) ? 'Edge'
		: /(CriOS|Chrome)\//.test(ua) ? 'Chrome'
		: /(FxiOS|Firefox)\//.test(ua) ? 'Firefox'
		: /Safari\//.test(ua) ? 'Safari'
		: '';
	return browser ? `${model} · ${browser}` : model;
}

export function readDevices(dataDir) {
	try {
		const d = JSON.parse(readFileSync(join(dataDir, 'devices.json'), 'utf8'));
		return Array.isArray(d.devices) ? d.devices : [];
	} catch {
		return [];
	}
}

export function writeDevices(dataDir, devices) {
	writeFileSync(join(dataDir, 'devices.json'), JSON.stringify({ devices }, null, 1), { mode: 0o600 });
}

export function createDevices({ dataDir, log }) {
	const file = join(dataDir, 'devices.json');
	let devices = readDevices(dataDir);
	const invites = new Map(); // hash(code) → { perms, name, expires }
	const listeners = new Set(); // (id) => …: a device changed or was removed
	let writing = false;

	const save = () => {
		writing = true;
		writeDevices(dataDir, devices);
		setTimeout(() => (writing = false), 2500);
	};
	const changed = (id) => {
		for (const fn of listeners) fn(id);
	};
	// Edited from outside (the CLI): devices gone or changed lose their open views.
	watchFile(file, { interval: 2000 }, () => {
		if (writing) return;
		const before = new Map(devices.map((d) => [d.id, JSON.stringify(d.perms)]));
		devices = readDevices(dataDir);
		const now = new Map(devices.map((d) => [d.id, JSON.stringify(d.perms)]));
		for (const [id, p] of before) if (now.get(id) !== p) changed(id);
	});

	const hasAdmin = () => devices.some((d) => d.perms.admin);
	const view = (d) => ({ id: d.id, name: d.name, perms: d.perms, created: d.created, seen: d.seen });

	function add(req, perms, name) {
		const id = crypto.randomBytes(6).toString('base64url');
		const secret = crypto.randomBytes(24).toString('base64url');
		const d = {
			id,
			key: hash(secret),
			name: String(name || deviceName(req.headers['user-agent'])).slice(0, 60),
			perms: cleanPerms(perms),
			created: Date.now(),
			seen: Date.now(),
		};
		// Nobody can manage the devices yet: the first one in can.
		if (!hasAdmin()) d.perms.admin = true;
		devices.push(d);
		save();
		log(`paired ${d.name} (${id}): ${PERMS.filter((k) => d.perms[k]).join(', ') || 'view only'}`);
		return { device: d, cookie: `${id}.${secret}` };
	}

	return {
		/** A device paired through the PC's own link: everything but managing the others. */
		pairOwner: (req) => add(req, { control: true, files: true, term: true }),

		/** The device behind a cookie value, or null. Marks it seen (written once a minute). */
		fromCookie(value) {
			const [id, secret] = String(value || '').split('.');
			if (!id || !secret) return null;
			const d = devices.find((x) => x.id === id);
			if (!d || !sameHash(hash(secret), d.key)) return null;
			if (Date.now() - d.seen > 60000) {
				d.seen = Date.now();
				save();
			}
			return d;
		},

		/** A one-time link for a new phone with these permissions, valid for 10 minutes. */
		invite(perms, name) {
			const code = crypto.randomBytes(18).toString('base64url');
			const expires = Date.now() + INVITE_MS;
			invites.set(hash(code), { perms: cleanPerms(perms), name: name ? String(name).slice(0, 60) : null, expires });
			for (const [k, v] of invites) if (v.expires < Date.now()) invites.delete(k);
			return { code, expires };
		},

		/** Uses an invite code up: the new device, or null when it is unknown or expired. */
		redeem(req, code) {
			const k = hash(String(code || ''));
			const inv = invites.get(k);
			invites.delete(k);
			if (!inv || inv.expires < Date.now()) return null;
			return add(req, inv.perms, inv.name);
		},

		list: () => devices.map(view),
		get: (id) => devices.find((d) => d.id === id) || null,

		/** Renames or re-permits a device; the last admin keeps "admin". */
		update(id, { name, perms }) {
			const d = devices.find((x) => x.id === id);
			if (!d) throw Object.assign(new Error('no such device'), { code: 'not-found' });
			if (name != null) d.name = String(name).trim().slice(0, 60) || d.name;
			if (perms) {
				const next = cleanPerms({ ...d.perms, ...perms });
				if (d.perms.admin && !next.admin && !devices.some((x) => x !== d && x.perms.admin)) throw Object.assign(new Error('the last admin keeps admin'), { code: 'last-admin' });
				d.perms = next;
			}
			save();
			changed(id);
			return view(d);
		},

		remove(id) {
			const d = devices.find((x) => x.id === id);
			if (!d) throw Object.assign(new Error('no such device'), { code: 'not-found' });
			if (d.perms.admin && !devices.some((x) => x !== d && x.perms.admin) && devices.length > 1) throw Object.assign(new Error('the last admin stays'), { code: 'last-admin' });
			devices = devices.filter((x) => x !== d);
			save();
			log(`removed ${d.name} (${id})`);
			changed(id);
		},

		onChange: (fn) => listeners.add(fn),
		stop: () => unwatchFile(file),
	};
}
