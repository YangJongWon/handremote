// Tailscale not ready when handremote starts (logon): the away-from-home address is tried
// again, and once it works, endpoint.json carries it for handide.
// Run: node --experimental-test-module-mocks scripts/check-remote-retry.mjs  (about 35 s)
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock } from 'node:test';

let tries = 0;
const tailscale = new URL('../server/tailscale.mjs', import.meta.url).href;
const real = await import(`${tailscale}?real`); // its other exports stay as they are
mock.module(tailscale, {
	namedExports: {
		...real,
		startTailscale: async () => (++tries === 1 ? { reason: 'Tailscale is Starting' } : { url: 'https://pc.example.ts.net:9443', stop() {} }),
	},
});
const { startServer } = await import('../server/server.mjs');

const dataDir = await mkdtemp(join(tmpdir(), 'handremote-retry-'));
const lines = [];
const server = await startServer({ dataDir, port: 9187, tsPort: 9443, local: false, remote: true, log: (l) => lines.push(l) });
const endpoint = async () => JSON.parse(await readFile(join(dataDir, 'endpoint.json'), 'utf8'));

assert.equal(tries, 1);
assert.equal((await endpoint()).url, undefined, 'no address while Tailscale is starting');
assert.ok(lines.some((l) => /not available: Tailscale is Starting; trying again/.test(l)));

const until = Date.now() + 40_000;
while (tries < 2 && Date.now() < until) await new Promise((r) => setTimeout(r, 500));
await new Promise((r) => setTimeout(r, 500));
assert.equal(tries, 2, 'tried again after 30 seconds');
assert.match((await endpoint()).url, /^https:\/\/pc\.example\.ts\.net:9443\/\?tkn=/);
assert.ok(lines.some((l) => /link ready \(try 2\)/.test(l)));
assert.equal(lines.filter((l) => /not available/.test(l)).length, 1, 'said once, not on every try');

console.log('PASS: Tailscale not ready at start: tried again after 30 s, then endpoint.json and the QR carry the address');
await server.close();
