// Prefer an app's own Tailscale Service name only after it reaches this exact process.
// Routing is provisioned separately; discovery never changes the PC's Tailscale identity.
import http from 'node:http';
import https from 'node:https';

export function namedAppUrl(dnsName, service) {
	const name = String(service).replace(/^svc:/, '');
	if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) throw new Error('Tailscale service name must be a DNS label (1–63 lowercase letters, numbers or hyphens)');
	const host = String(dnsName).replace(/\.$/, '');
	if (!/^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/i.test(host)) return null;
	return `https://${name}.${host.split('.').slice(1).join('.')}`;
}

export function appHealth(url, { local = false } = {}) {
	return new Promise((resolve) => {
		const req = (url.startsWith('https:') ? https : http).get(url, { rejectUnauthorized: !local, agent: false }, (res) => {
			res.resume();
			resolve({ status: res.statusCode, app: res.headers['x-hand-app'], instance: res.headers['x-hand-instance'] });
		});
		// Includes DNS lookup and connection establishment, unlike socket-only timeouts.
		const timer = setTimeout(() => req.destroy(), 2500);
		req.on('error', () => resolve(null));
		req.on('close', () => clearTimeout(timer));
	});
}

export async function preferAppAddress({ app, dnsName, service = app, port, tls, legacy, log = () => {} }, probe = appHealth) {
	const url = namedAppUrl(dnsName, service);
	if (!url || url === legacy.url) return legacy;
	const path = `/__${app}/health`;
	const results = await Promise.allSettled([
		probe(`${tls ? 'https' : 'http'}://127.0.0.1:${port}${path}`, { local: true }),
		probe(`${url}${path}`),
	]);
	const [local, named] = results.map((result) => result.status === 'fulfilled' ? result.value : null);
	if (local?.status !== 204 || named?.status !== 204 || local.app !== app || named.app !== app || !local.instance || named.instance !== local.instance) {
		log(`${app}: named Tailscale address is not ready; keeping ${legacy.url}. See docs/tailscale-app-addresses.md.`);
		return legacy;
	}
	log(`${app}: primary Tailscale address ${url}`);
	return { ...legacy, url, public: false, named: true, alternates: [{ url: legacy.url, public: !!legacy.public, remote: true, label: `${app} · ${legacy.public ? 'public link' : 'Tailscale PC address'}` }] };
}

// Approved Service routing persists in tailscaled. Use it before trying to provision a
// legacy device endpoint: a tagged host may no longer have permission to run Funnel.
export async function configuredAppAddress({ app, dnsName, service = app, port, tls, legacyPort = 443, serveStatus, log }, probe = appHealth) {
	const url = namedAppUrl(dnsName, service);
	if (!url) return null;
	const name = String(service).replace(/^svc:/, '');
	const target = `${tls ? 'https+insecure' : 'http'}://127.0.0.1:${port}`;
	if (serveStatus?.Services?.[`svc:${name}`]?.Web?.[`${new URL(url).hostname}:443`]?.Handlers?.['/']?.Proxy !== target) return null;
	const host = String(dnsName).replace(/\.$/, '');
	const deviceHost = `${host}:${legacyPort}`;
	const hasLegacy = serveStatus?.Web?.[deviceHost]?.Handlers?.['/']?.Proxy === target;
	const legacy = { url: `https://${host}${legacyPort === 443 ? '' : `:${legacyPort}`}`, public: hasLegacy && !!serveStatus?.AllowFunnel?.[deviceHost], stop() {} };
	const preferred = await preferAppAddress({ app, dnsName, service, port, tls, legacy, log }, probe);
	if (preferred.named) return { ...preferred, alternates: hasLegacy ? preferred.alternates : [] };
	return hasLegacy ? { ...legacy, namedPending: true } : { code: 'service-pending', reason: `${url} is configured but not answering as this app yet` };
}
