import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRemoteArgs, readRemoteSettings, runRemoteSetup } from '../server/remote-setup.mjs';

await mkdir('check-output/remote-cli', { recursive: true });
const base = await mkdtemp('check-output/remote-cli/key-free-');
function fixture(app, changes = {}) {
 const port = app === 'handide' ? 9000 : 9100;
 const httpsPort = app === 'handide' ? 443 : 9443;
 const host = 'my-pc.example.ts.net';
 const state = { signedIn: true, routes: {}, instance: 'same-process', remoteApp: app, ...changes };
 const calls = [], output = [];
 const dataDir = join(base, `${app}-${Math.random().toString(36).slice(2)}`);
 const deps = {
  env: {},
  run: async (_, args) => {
   calls.push(args);
   if (args.join(' ') === 'up') { state.signedIn = true; return { code: 0, output: '' }; }
   if (args.join(' ') === 'status --json') return { code: 0, output: JSON.stringify({ BackendState: state.signedIn ? 'Running' : 'NeedsLogin', Self: state.signedIn ? { DNSName: `${host}.`, UserID: 123, ...(state.tags ? { Tags: state.tags } : {}) } : {} }) };
   if (args.join(' ') === 'serve status --json') return { code: 0, output: JSON.stringify(state.routes) };
   if (args[0] === 'serve' && (args[1]?.startsWith('--service=') || args[1] === 'clear')) return { code: 0, output: state.serveOutput || '' };
   throw Error(`Unexpected Tailscale mutation: ${args.join(' ')}`);
  },
  probe: async (_, options) => ({ status: 204, app: options?.local ? app : state.remoteApp, instance: options?.local ? 'same-process' : state.instance }),
 };
 const run = args => runRemoteSetup({ app, defaultPort: port, dataDir, args, log: value => output.push(value),
  prepare: async () => calls.push('prepare'),
  publish: async opts => { calls.push({ publish: opts }); return { url: `https://${host}${opts.httpsPort === 443 ? '' : `:${opts.httpsPort}`}` }; },
 }, deps);
 const deviceRoute = target => ({ Web: { [`${host}:${httpsPort}`]: { Handlers: { '/': { Proxy: target || `https+insecure://127.0.0.1:${port}` } } } } });
 return { app, port, httpsPort, host, state, calls, output, dataDir, deps, run, deviceRoute };
}

for (const app of ['handide', 'handremote']) {
 const f = fixture(app);
 const result = await f.run(['setup']);
 assert.equal(result.url, `https://${f.host}${f.httpsPort === 443 ? '' : `:${f.httpsPort}`}`);
 assert.equal(result.state, 'setup-complete');
 assert.deepEqual(f.calls.find(call => call?.publish)?.publish, { port: f.port, httpsPort: f.httpsPort, service: app, public: false });
 const saved = JSON.parse(await readFile(join(f.dataDir, 'remote-service.json'), 'utf8'));
 assert.deepEqual(saved, { version: 2, app, port: f.port, httpsPort: f.httpsPort, mode: 'private' });
 assert.equal((await readRemoteSettings(f.dataDir, app)).port, f.port);
 assert.ok(f.calls.filter(Array.isArray).every(args => ['status --json', 'serve status --json'].includes(args.join(' '))));

 const planned = fixture(app);
 assert.equal((await planned.run(['setup', '--plan'])).state, 'plan');
 assert.equal(existsSync(planned.dataDir), false);
 assert.ok(planned.calls.every(Array.isArray));
 const help = fixture(app);
 assert.equal((await help.run(['--help'])).help, true);
 assert.deepEqual(help.calls, []);

 const login = fixture(app, { signedIn: false });
 assert.equal((await login.run(['setup'])).state, 'setup-complete');
 assert.equal(login.calls.filter(call => Array.isArray(call) && call.join(' ') === 'up').length, 1);
 for (const args of [['status', '--json'], ['setup', '--plan']]) {
  const signedOut = fixture(app, { signedIn: false });
  assert.equal((await signedOut.run(args)).state, 'signed-out');
  assert.deepEqual(signedOut.calls, [['status', '--json']]);
  assert.equal(existsSync(signedOut.dataDir), false);
 }

 const status = fixture(app);
 assert.equal((await status.run(['status', '--json'])).state, 'not-configured');
 status.state.routes = status.deviceRoute();
 assert.equal((await status.run(['status', '--json'])).state, 'ready');
 status.state.instance = 'another-process';
 assert.equal((await status.run(['status', '--json'])).state, 'configured');
 status.state.instance = 'same-process'; status.state.remoteApp = 'another-app';
 assert.equal((await status.run(['status'])).state, 'configured');
 assert.equal(existsSync(status.dataDir), false);
 assert.ok(status.calls.every(Array.isArray));

 const collision = fixture(app);
 collision.state.routes = collision.deviceRoute('http://127.0.0.1:1234');
 await assert.rejects(collision.run(['setup']), /already forwards/);
 assert.equal(collision.calls.some(call => call?.publish), false);
 assert.equal(existsSync(collision.dataDir), false);

 const legacy = fixture(app);
 await mkdir(legacy.dataDir, { recursive: true });
 await writeFile(join(legacy.dataDir, 'remote-service.json'), JSON.stringify({ version: 1, app, name: 'custom-name', port: legacy.port, hostTag: 'tag:old' }));
 assert.equal((await readRemoteSettings(legacy.dataDir, app)).name, 'custom-name');
 legacy.state.routes = { Services: { 'svc:custom-name': { Web: { 'custom-name.example.ts.net:443': { Handlers: { '/': { Proxy: `https+insecure://127.0.0.1:${legacy.port}` } } } } } } };
 assert.equal((await legacy.run(['status'])).url, 'https://custom-name.example.ts.net');
 for (const flag of ['--api-key-env', '--tag', '--allow']) await assert.rejects(fixture(app).run(['setup', flag, 'unused']), /Unknown remote option/);
 assert.throws(() => parseRemoteArgs(['setup', '--port', '0'], { app, dataDir: base }), /Port/);
 assert.throws(() => parseRemoteArgs(['setup', '--name', '--no-name'], { app, dataDir: base }), /not both/);

 // Option B: the app-name address. An untagged PC gets the one-time console steps, and
 // nothing about Services is changed yet.
 const untagged = fixture(app);
 const guide = await untagged.run(['setup', '--name']);
 assert.equal(guide.state, 'named-needs-admin');
 assert.equal(guide.url, `https://${untagged.host}${untagged.httpsPort === 443 ? '' : `:${untagged.httpsPort}`}`);
 assert.equal(guide.namedUrl, `https://${app}.example.ts.net`);
 assert.ok(guide.policy.includes('"svc:handide": ["tag:handapps"]'));
 assert.ok(guide.policy.includes('"svc:handremote": ["tag:handapps"]'));
 assert.ok(guide.actions.some(line => line.includes('admin/services') && line.includes(`"${app}"`)));
 assert.equal(untagged.calls.some(call => Array.isArray(call) && call[0] === 'serve' && call[1] !== 'status'), false);
 assert.equal((await readRemoteSettings(untagged.dataDir, app)).name, undefined);
 // A tagged PC serves the Service and remembers its name.
 const tagged = fixture(app, { tags: ['tag:handapps'], serveOutput: 'approval from an admin is required' });
 const named = await tagged.run(['setup', '--name']);
 assert.equal(named.url, `https://${app}.example.ts.net`);
 assert.equal(named.state, 'named-pending-approval');
 assert.ok(tagged.calls.some(call => Array.isArray(call) && call.join(' ') === `serve --service=svc:${app} --https=443 https+insecure://127.0.0.1:${tagged.port}`));
 assert.equal((await readRemoteSettings(tagged.dataDir, app)).name, app);
 assert.equal((await tagged.run(['setup', '--name', '--plan'])).actions.some(line => line.includes(`svc:${app}`)), true);
 // --no-name ends this PC's endpoint and forgets the name.
 const off = await tagged.run(['setup', '--no-name']);
 assert.equal(off.state, 'setup-complete');
 assert.ok(tagged.calls.some(call => Array.isArray(call) && call.join(' ') === `serve clear svc:${app}`));
 assert.equal((await readRemoteSettings(tagged.dataDir, app)).name, undefined);
}
const custom = fixture('handremote');
await custom.run(['setup', '--port', '9300', '--ts-port', '9543']);
assert.deepEqual(custom.calls.find(call => call?.publish)?.publish, { port: 9300, httpsPort: 9543, service: 'handremote', public: false });
await assert.rejects(custom.run(['setup', '--public']), /Unknown/);
const publicApp = fixture('handide');
await publicApp.run(['setup', '--public']);
assert.equal((await readRemoteSettings(publicApp.dataDir, 'handide')).mode, 'public');
console.log('PASS: both apps set up with ordinary Tailscale login; read-only plans/status, routing collisions, app/process identity, custom ports and saved named-address compatibility, optional app-name address (--name, --no-name)');
