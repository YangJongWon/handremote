// The PC's files for the phone: folders to browse, a file to download, and files from the
// phone saved into a folder. The server runs as the PC's user, so it sees what that user
// sees; the phone opens files on the PC through the agent (server.mjs, "open").
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import { basename, dirname, isAbsolute, join, normalize } from 'node:path';
import { pipeline } from 'node:stream/promises';

const MAX_ENTRIES = 3000;

/** Files the phone uploaded: not downloads, so no "download finished" for them (downloads.mjs). */
export const uploaded = new Set();

/** An absolute local path from the phone, normalized; null for anything else. */
export function localPath(p) {
	if (typeof p !== 'string' || !p || p.includes('\0')) return null;
	const n = normalize(p);
	if (!isAbsolute(n) || n.startsWith('\\\\')) return null; // no UNC shares
	return n;
}

/** The starting places: the user's usual folders, then the drives. */
async function places() {
	const home = os.homedir();
	const known = [
		['desktop', join(home, 'Desktop')],
		['downloads', join(home, 'Downloads')],
		['documents', join(home, 'Documents')],
		['pictures', join(home, 'Pictures')],
		['home', home],
	].filter(([, p]) => existsSync(p));
	const drives = [];
	for (let c = 67; c <= 90; c++) {
		const root = `${String.fromCharCode(c)}:\\`;
		if (existsSync(root)) drives.push(root);
	}
	return {
		places: known.map(([key, path]) => ({ key, path, name: basename(path) || path })),
		drives: drives.map((path) => ({ path, name: path.slice(0, 2) })),
	};
}

/** A folder's entries: folders first, then files, by name. */
async function list(path) {
	const dirents = await readdir(path, { withFileTypes: true });
	const entries = [];
	for (const d of dirents.slice(0, MAX_ENTRIES)) {
		const full = join(path, d.name);
		let s = null;
		try {
			s = await stat(full);
		} catch {} // locked or vanished: listed without size
		const dir = s ? s.isDirectory() : d.isDirectory();
		entries.push({ name: d.name, dir, size: dir ? null : (s?.size ?? null), mtime: s?.mtimeMs ?? null });
	}
	const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
	entries.sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : coll.compare(a.name, b.name)));
	const parent = dirname(path);
	return { path, parent: parent !== path ? parent : null, entries, more: dirents.length > MAX_ENTRIES };
}

/** A name not taken in the folder: "a.jpg", then "a (1).jpg"… */
function freeName(dir, name) {
	const safe = basename(String(name || 'upload')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 200) || 'upload';
	const dot = safe.lastIndexOf('.');
	const [stem, ext] = dot > 0 ? [safe.slice(0, dot), safe.slice(dot)] : [safe, ''];
	for (let i = 0; ; i++) {
		const candidate = join(dir, i ? `${stem} (${i})${ext}` : safe);
		if (!existsSync(candidate)) return candidate;
	}
}

/**
 * /api/files (GET ?path=…: a folder, or the starting places without one),
 * /api/file (GET ?path=…: the file itself), /api/files/upload (POST ?dir=…&name=…: the body).
 * Answers true when it handled the request.
 */
export async function handleFiles(req, res, url, sendJson) {
	const p = url.pathname;
	if (p === '/api/files' && req.method === 'GET') {
		const raw = url.searchParams.get('path');
		if (!raw) return sendJson(res, 200, { ok: true, ...(await places()) }), true;
		const path = localPath(raw);
		if (!path) return sendJson(res, 400, { ok: false, error: 'not a local path' }), true;
		try {
			return sendJson(res, 200, { ok: true, ...(await list(path)) }), true;
		} catch (err) {
			return sendJson(res, err.code === 'ENOENT' ? 404 : 403, { ok: false, error: err.code === 'EPERM' || err.code === 'EACCES' ? 'no access' : err.message, code: err.code }), true;
		}
	}
	if (p === '/api/file' && req.method === 'GET') {
		const path = localPath(url.searchParams.get('path'));
		let s = null;
		try {
			s = path && (await stat(path));
		} catch {}
		if (!s?.isFile()) return sendJson(res, 404, { ok: false, error: 'not found' }), true;
		const name = basename(path);
		res.writeHead(200, {
			'content-type': 'application/octet-stream',
			'content-length': s.size,
			'content-disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			'cache-control': 'no-store',
		});
		await pipeline(createReadStream(path), res).catch(() => res.destroy());
		return true;
	}
	if (p === '/api/files/upload' && req.method === 'POST') {
		const dir = localPath(url.searchParams.get('dir'));
		let s = null;
		try {
			s = dir && (await stat(dir));
		} catch {}
		if (!s?.isDirectory()) return sendJson(res, 404, { ok: false, error: 'no such folder' }), true;
		const target = freeName(dir, url.searchParams.get('name'));
		uploaded.add(target.toLowerCase());
		setTimeout(() => uploaded.delete(target.toLowerCase()), 10 * 60 * 1000).unref();
		try {
			await pipeline(req, createWriteStream(target, { flags: 'wx' }));
			return sendJson(res, 200, { ok: true, path: target, name: basename(target) }), true;
		} catch (err) {
			return sendJson(res, 500, { ok: false, error: err.message }), true;
		}
	}
	return false;
}
