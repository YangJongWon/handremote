// The phone's microphone needs a virtual audio cable on the PC (Windows has no way for a
// program to add a microphone). This makes getting one a tap from the phone: the official
// VB-CABLE package from vb-audio.com, its setup checked to be signed by its author, then
// opened on the PC as it is. The person installs it in the author's own setup window
// (its licence asks that it not be folded into another program's installer).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAGE = 'https://vb-audio.com/Cable/';
const FALLBACK = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack46.zip';
const SIGNER = 'BUREL VINCENT'; // VB-Audio's code signing certificate

function ps(script, timeout = 60000) {
	return new Promise((resolve, reject) => {
		let out = '';
		const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
		const timer = setTimeout(() => (child.kill(), reject(new Error('timed out'))), timeout);
		child.stdout.on('data', (d) => (out += d));
		child.stderr.on('data', (d) => (out += d));
		child.on('error', (err) => (clearTimeout(timer), reject(err)));
		child.on('close', (code) => (clearTimeout(timer), code === 0 ? resolve(out.trim()) : reject(new Error(out.trim() || `exit ${code}`))));
	});
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** The newest driver pack the official page links to. */
async function packUrl() {
	try {
		const html = await (await fetch(PAGE, { signal: AbortSignal.timeout(15000) })).text();
		const links = [...new Set(html.match(/https:\/\/download\.vb-audio\.com\/Download_CABLE\/VBCABLE_Driver_Pack(\d+)\.zip/g) || [])];
		links.sort((a, b) => Number(b.match(/Pack(\d+)/)[1]) - Number(a.match(/Pack(\d+)/)[1]));
		if (links[0]) return links[0];
	} catch {}
	return FALLBACK;
}

export function createCableInstaller({ dataDir, log }) {
	const dir = join(dataDir, 'cache', 'vbcable');
	let state = { phase: 'idle' };
	let running = null;

	async function prepare() {
		state = { phase: 'downloading' };
		const url = await packUrl();
		const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
		if (!res.ok) throw new Error(`download failed (${res.status})`);
		await rm(dir, { recursive: true, force: true });
		await mkdir(dir, { recursive: true });
		const zip = join(dir, 'pack.zip');
		await writeFile(zip, Buffer.from(await res.arrayBuffer()));
		state = { phase: 'verifying', url };
		const files = join(dir, 'files');
		await ps(`Expand-Archive -LiteralPath ${q(zip)} -DestinationPath ${q(files)} -Force`);
		const setup = join(files, process.arch === 'ia32' ? 'VBCABLE_Setup.exe' : 'VBCABLE_Setup_x64.exe');
		if (!existsSync(setup)) throw new Error('the package has no setup program');
		const sig = await ps(`$s = Get-AuthenticodeSignature -LiteralPath ${q(setup)}; "$($s.Status)|$($s.SignerCertificate.Subject)"`);
		const [status, subject = ''] = sig.split('|');
		if (status !== 'Valid' || !subject.includes(SIGNER)) throw new Error(`the setup is not signed by VB-Audio (${status})`);
		return { url, setup };
	}

	async function work(dry) {
		try {
			const { url, setup } = await prepare();
			if (dry) return (state = { phase: 'ready', url });
			// Its own setup window, as an administrator: Windows asks on the PC (or, with the
			// SYSTEM helper, on the phone's secure screen view).
			state = { phase: 'asking', url };
			await ps(`Start-Process -FilePath ${q(setup)} -WorkingDirectory ${q(join(setup, '..'))} -Verb RunAs`, 120000);
			state = { phase: 'opened', url };
			log('VB-CABLE setup opened on the PC');
		} catch (err) {
			const cancelled = /canceled|cancelled|취소/i.test(err.message);
			state = { phase: 'failed', error: cancelled ? 'cancelled' : err.message };
			log(`VB-CABLE: ${state.error}`);
		} finally {
			running = null;
		}
	}

	return {
		state: () => state,
		/** Starts it (dry: download and check only); the phone polls state(). */
		start(dry = false) {
			if (!running) running = work(dry);
			return state;
		},
	};
}

/** The name the recording side of a cable shows, for "pick … as the microphone". */
export function cableMicName(device) {
	if (!device) return null;
	return /Input/i.test(device) ? device.replace(/Input/i, 'Output') : device;
}
