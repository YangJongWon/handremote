// Finished downloads in the PC's Downloads folder, for the phone to offer "open" or "show in
// folder". Browsers write to a temporary name (.crdownload, .part…) and rename it when done,
// so a file counts once it has its final name and its size stopped changing.
import { existsSync, readdirSync, statSync, watch } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { join } from 'node:path';

const TEMP = /\.(crdownload|part|partial|download|tmp|opdownload|!ut)$/i;
const RECENT = 2 * 60 * 1000; // a file written longer ago than this is not a new download

/** The Downloads folder, also when it was moved (User Shell Folders). */
function downloadsDir() {
	if (process.env.HANDREMOTE_DOWNLOADS) return existsSync(process.env.HANDREMOTE_DOWNLOADS) ? process.env.HANDREMOTE_DOWNLOADS : null; // checks
	try {
		const out = execFileSync(
			'reg',
			['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders', '/v', '{374DE290-123F-4565-9164-39C4925E467B}'],
			{ encoding: 'utf8', windowsHide: true },
		);
		const m = /REG_(?:EXPAND_)?SZ\s+(.+)/.exec(out);
		if (m) {
			const dir = m[1].trim().replace(/%([^%]+)%/g, (_, k) => process.env[k] ?? `%${k}%`);
			if (existsSync(dir)) return dir;
		}
	} catch {}
	const dir = join(os.homedir(), 'Downloads');
	return existsSync(dir) ? dir : null;
}

export function watchDownloads({ log, ignore = () => false }) {
	const dir = downloadsDir();
	const items = []; // { id, name, path, size, at }
	let seq = 0;
	const known = new Map(); // name → `${size}:${mtime}` already reported
	const timers = new Map();
	if (!dir) return { dir: null, recent: () => [], get: () => null };

	// What is already there is not new.
	try {
		for (const name of readdirSync(dir)) {
			try {
				const s = statSync(join(dir, name));
				if (s.isFile()) known.set(name, `${s.size}:${s.mtimeMs}`);
			} catch {}
		}
	} catch {}

	const check = (name, last) => {
		timers.delete(name);
		const path = join(dir, name);
		let s;
		try {
			s = statSync(path);
		} catch {
			return;
		}
		if (!s.isFile() || !s.size || Date.now() - s.mtimeMs > RECENT || ignore(path)) return;
		const sig = `${s.size}:${s.mtimeMs}`;
		if (known.get(name) === sig) return;
		// Still growing: look again shortly.
		if (last !== sig) return void timers.set(name, setTimeout(() => check(name, sig), 1000));
		known.set(name, sig);
		items.push({ id: ++seq, name, path, size: s.size, at: Date.now() });
		if (items.length > 20) items.shift();
		log(`download finished: ${name}`);
	};

	try {
		watch(dir, (event, name) => {
			if (!name || TEMP.test(name) || name.startsWith('~$') || name.startsWith('.')) return;
			clearTimeout(timers.get(name));
			timers.set(name, setTimeout(() => check(name, null), 800));
		});
	} catch (err) {
		log(`downloads: cannot watch ${dir}: ${err.message}`);
	}

	return {
		dir,
		/** The last few finished downloads, newest last (no paths: the phone asks by id). */
		recent: () => items.slice(-5).map(({ id, name, size, at }) => ({ id, name, size, at })),
		get: (id) => items.find((d) => d.id === id) || null,
	};
}
