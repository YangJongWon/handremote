// handremote phone UI: the PC's windows, widgets, tray icons, web apps and servers by
// category; a tapped window opens at the phone's size and takes taps, scrolls and text.
// Every URL is relative, so the same page works at "/" (standalone) and at
// "/__handide/screen/" (opened through handide).
'use strict';

const STRINGS = {
	ko: {
		loading: '불러오는 중…', send: '보내기', type: '입력할 내용', apps: '앱 창', widgets: '위젯', tray: '트레이', web: '웹 앱', servers: '서버·서비스', secure: '보안 화면',
		secureRow: 'UAC 확인 창 또는 잠금 화면', secureHint: '관리자 승인이나 PIN 입력을 기다리는 중', minimized: '최소화', viewOnly: '보기만', front: '앞', hidden: '숨김',
		fitPhone: '폰 크기', fitOrig: '원래 크기', none: '없음', offline: 'PC에 연결할 수 없습니다', gone: '창이 닫혔습니다',
		'err.not-front': 'PC에서 다른 창이 앞을 막고 있어 보내지 않았습니다. 다시 시도하세요.',
		'err.covered': '그 자리를 다른 창이 가리고 있어 보내지 않았습니다.',
		'err.view-only': '관리자 권한 창이라 보기만 됩니다. PC에서 handremote helper install로 SYSTEM 도우미를 설치하면 조작할 수 있습니다.',
		'err.no-helper': 'SYSTEM 도우미가 실행 중이 아닙니다.',
		helperMissing: '관리자 권한 창, UAC 확인 창, 잠금 화면까지 다루려면 PC에서 <code>handremote helper install</code>을 한 번 실행하세요.',
		helperOff: '공개 링크로 열려 있어 SYSTEM 도우미는 꺼져 있습니다.',
		helperDown: 'SYSTEM 도우미가 설치되어 있지만 응답하지 않습니다. PC를 다시 시작하거나 helper install을 다시 실행하세요.',
		path: '경로', cmd: '명령줄', started: '시작', memory: '메모리', ports: '포트', trayHint: '탭: 클릭 · 길게: 오른쪽 클릭', opened: '열린 창이 없습니다', pc: 'PC',
	},
	en: {
		loading: 'Loading…', send: 'Send', type: 'Text to type', apps: 'Windows', widgets: 'Widgets', tray: 'Tray', web: 'Web apps', servers: 'Servers', secure: 'Secure screen',
		secureRow: 'UAC prompt or lock screen', secureHint: 'Waiting for approval or a PIN', minimized: 'minimized', viewOnly: 'view only', front: 'front', hidden: 'hidden',
		fitPhone: 'Phone size', fitOrig: 'Original', none: 'None', offline: 'Cannot reach the PC', gone: 'The window closed',
		'err.not-front': 'Another window stayed in front on the PC, so nothing was sent. Try again.',
		'err.covered': 'Another window covers that spot on the PC, so nothing was sent.',
		'err.view-only': 'An administrator window: view only. Install the SYSTEM helper on the PC (handremote helper install) to use it.',
		'err.no-helper': 'The SYSTEM helper is not running.',
		helperMissing: 'To reach administrator windows, UAC prompts and the lock screen, run <code>handremote helper install</code> on the PC once.',
		helperOff: 'Opened through a public link, so the SYSTEM helper is off.',
		helperDown: 'The SYSTEM helper is installed but does not answer. Restart the PC or run helper install again.',
		path: 'Path', cmd: 'Command line', started: 'Started', memory: 'Memory', ports: 'Ports', trayHint: 'Tap: click · Hold: right-click', opened: 'Nothing opened', pc: 'PC',
	},
	ja: {
		loading: '読み込み中…', send: '送信', type: '入力する内容', apps: 'ウィンドウ', widgets: 'ウィジェット', tray: 'トレイ', web: 'Web アプリ', servers: 'サーバー', secure: 'セキュア画面',
		secureRow: 'UAC 確認またはロック画面', secureHint: '承認または PIN を待っています', minimized: '最小化', viewOnly: '表示のみ', front: '前面', hidden: '非表示',
		fitPhone: 'スマホサイズ', fitOrig: '元のサイズ', none: 'なし', offline: 'PC に接続できません', gone: 'ウィンドウが閉じました',
		'err.not-front': 'PC で別のウィンドウが前面にあるため送信しませんでした。もう一度試してください。',
		'err.covered': 'その位置を別のウィンドウが覆っているため送信しませんでした。',
		'err.view-only': '管理者ウィンドウのため表示のみです。PC で handremote helper install を実行すると操作できます。',
		'err.no-helper': 'SYSTEM ヘルパーが動いていません。',
		helperMissing: '管理者ウィンドウ、UAC、ロック画面まで扱うには PC で <code>handremote helper install</code> を一度実行してください。',
		helperOff: '公開リンクで開いているため SYSTEM ヘルパーはオフです。',
		helperDown: 'SYSTEM ヘルパーは入っていますが応答しません。PC を再起動するか helper install をやり直してください。',
		path: 'パス', cmd: 'コマンドライン', started: '開始', memory: 'メモリ', ports: 'ポート', trayHint: 'タップ: クリック · 長押し: 右クリック', opened: '開いたウィンドウはありません', pc: 'PC',
	},
	zh: {
		loading: '加载中…', send: '发送', type: '要输入的内容', apps: '窗口', widgets: '小组件', tray: '托盘', web: '网页应用', servers: '服务器', secure: '安全屏幕',
		secureRow: 'UAC 提示或锁屏', secureHint: '正在等待批准或 PIN', minimized: '已最小化', viewOnly: '仅查看', front: '前台', hidden: '隐藏',
		fitPhone: '手机尺寸', fitOrig: '原始尺寸', none: '无', offline: '无法连接到电脑', gone: '窗口已关闭',
		'err.not-front': '电脑上有其他窗口挡在前面，未发送。请重试。',
		'err.covered': '该位置被其他窗口遮住，未发送。',
		'err.view-only': '管理员窗口，仅可查看。在电脑上运行 handremote helper install 后即可操作。',
		'err.no-helper': 'SYSTEM 助手未运行。',
		helperMissing: '要操作管理员窗口、UAC 提示和锁屏，请在电脑上运行一次 <code>handremote helper install</code>。',
		helperOff: '通过公开链接打开，SYSTEM 助手已关闭。',
		helperDown: 'SYSTEM 助手已安装但没有响应。请重启电脑或重新运行 helper install。',
		path: '路径', cmd: '命令行', started: '启动', memory: '内存', ports: '端口', trayHint: '点按: 单击 · 长按: 右键', opened: '没有打开窗口', pc: '电脑',
	},
};
const lang = (navigator.language || 'en').slice(0, 2);
const S = STRINGS[lang] || STRINGS.en;
const t = (k) => S[k] ?? STRINGS.en[k] ?? k;
document.documentElement.lang = STRINGS[lang] ? lang : 'en';
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
document.getElementById('type').placeholder = t('type');

const linked = location.pathname.startsWith('/__handide/');
const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
	const e = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (v == null || v === false) continue;
		if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
		else if (k === 'html') e.innerHTML = v;
		else e.setAttribute(k, v === true ? '' : v);
	}
	for (const k of kids.flat()) if (k != null) e.append(k);
	return e;
};
const mb = (n) => (n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(1)} GB` : `${Math.round(n / (1 << 20))} MB`);

async function api(path, body) {
	const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
	const json = await res.json().catch(() => ({ ok: false }));
	if (!res.ok || json.ok === false) throw Object.assign(new Error(json.error || res.statusText), { code: json.code });
	return json;
}

// ---------------------------------------------------------------- long press on rows

/** Calls tap() on a short tap and hold() after a long press (or tap() when there is none). */
function pressable(el, tap, hold) {
	let timer = null;
	let held = false;
	let start = null;
	el.addEventListener('pointerdown', (e) => {
		held = false;
		start = [e.clientX, e.clientY];
		if (hold) timer = setTimeout(() => ((held = true), navigator.vibrate?.(15), hold()), 550);
	});
	const cancel = () => clearTimeout(timer);
	el.addEventListener('pointermove', (e) => start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10 && cancel());
	el.addEventListener('pointerup', cancel);
	el.addEventListener('pointercancel', cancel);
	el.addEventListener('contextmenu', (e) => e.preventDefault());
	el.addEventListener('click', () => !held && tap());
	return el;
}

// ---------------------------------------------------------------- list

let last = null;

function row({ icon, title, sub, badges = [], onTap, onHold, hwnd }) {
	const b = h('button', { type: 'button', class: 'row', 'data-hwnd': hwnd ?? null }, h('span', { class: 'ico' }, icon), h('span', { class: 'txt' }, h('span', { class: 't1' }, title), sub ? h('span', { class: 't2' }, sub) : null), ...badges);
	return pressable(b, onTap, onHold);
}

const badge = (text, cls = '') => h('span', { class: `badge ${cls}` }, text);
const group = (title, count, rows, cls = '') => (rows.length ? h('section', { class: `group ${cls}` }, h('h2', {}, title, count != null ? h('small', {}, String(count)) : null), h('div', { class: 'rows' }, rows)) : null);

function windowIcon(w) {
	const img = h('img', { src: `api/icon?hwnd=${w.hwnd}`, alt: '', loading: 'lazy' });
	img.addEventListener('error', () => img.replaceWith((w.proc || '?').slice(0, 1).toUpperCase()));
	return img;
}

function windowRow(w) {
	const usage = [w.proc, w.cpu != null ? `${w.cpu}%` : null, w.mem ? mb(w.mem) : null].filter(Boolean).join(' · ');
	const badges = [];
	if (w.fg) badges.push(badge(t('front'), 'live'));
	if (w.min) badges.push(badge(t('minimized')));
	if (w.viewOnly) badges.push(badge(t('viewOnly'), 'warn'));
	return row({ hwnd: w.hwnd, icon: windowIcon(w), title: w.title || w.proc || w.cls, sub: usage, badges, onTap: () => openViewer({ hwnd: w.hwnd, title: w.title || w.proc, fit: true }) });
}

function render(data) {
	last = data;
	$('host').textContent = data.host || t('pc');
	$('dot').className = 'dot on';
	const list = $('list');
	const apps = data.windows.filter((w) => w.kind === 'app');
	const widgets = data.windows.filter((w) => w.kind === 'widget');
	const web = data.servers.flatMap((s) => s.ports.filter((p) => p.web).map((p) => ({ ...p, name: s.name, pid: s.pid })));
	const parts = [];
	if (data.helper?.secure) {
		parts.push(group(t('secure'), null, [row({ icon: '🔒', title: t('secureRow'), sub: t('secureHint'), badges: [badge(data.helper.desktop || '', 'warn')], onTap: () => openViewer({ hwnd: 0, title: t('secure'), fit: false }) })], 'secure'));
	}
	parts.push(group(t('apps'), apps.length, apps.map(windowRow)));
	parts.push(group(t('widgets'), widgets.length, widgets.map(windowRow)));
	parts.push(
		group(
			t('tray'),
			data.tray.length,
			data.tray.map((i) =>
				row({
					icon: '•',
					title: i.name.split('\n')[0],
					sub: [i.name.split('\n').slice(1).join(' '), i.hidden ? t('hidden') : ''].filter(Boolean).join(' · ') || t('trayHint'),
					onTap: () => clickTray(i, 'left'),
					onHold: () => clickTray(i, 'right'),
				}),
			),
		),
	);
	parts.push(group(t('web'), web.length, web.map((p) => row({ icon: '◎', title: `localhost:${p.port}`, sub: p.name, onTap: () => openPort(p.port) }))));
	parts.push(
		group(
			t('servers'),
			data.servers.length,
			data.servers.map((s) => row({ icon: '▤', title: s.name, sub: `${t('ports')} ${s.ports.map((p) => p.port).join(', ')} · pid ${s.pid}`, onTap: () => showProc(s) })),
		),
	);
	const helper = data.helper || {};
	if (!helper.installed) parts.push(h('p', { class: 'note', html: t('helperMissing') }));
	else if (helper.allowed === false) parts.push(h('p', { class: 'note' }, t('helperOff')));
	else if (!helper.connected) parts.push(h('p', { class: 'note' }, t('helperDown')));
	list.replaceChildren(...parts.filter(Boolean));
	if (!list.children.length) list.append(h('p', { class: 'empty' }, t('none')));
	if (helper.secure && !viewer.ws) openViewer({ hwnd: 0, title: t('secure'), fit: false, auto: true });
}

let polling = null;
async function refresh() {
	try {
		render(await api('api/list'));
	} catch {
		$('dot').className = 'dot off';
		if (!last) $('list').replaceChildren(h('p', { class: 'empty' }, t('offline')));
	}
}

function schedule() {
	clearTimeout(polling);
	if (document.hidden) return;
	// The list every 3 s; while a window is open only the helper's desktop (for the secure screen).
	polling = setTimeout(async () => {
		if (viewer.ws) {
			try {
				const s = await api('api/state');
				if (s.helper?.secure && viewer.hwnd !== 0) openViewer({ hwnd: 0, title: t('secure'), fit: false, auto: true });
				if (!s.helper?.secure && viewer.hwnd === 0 && viewer.auto) closeViewer();
			} catch {}
		} else await refresh();
		schedule();
	}, viewer.ws ? 2000 : 3000);
}
document.addEventListener('visibilitychange', () => (document.hidden ? clearTimeout(polling) : (refresh(), schedule())));
$('refresh').addEventListener('click', () => refresh());

async function clickTray(item, button) {
	try {
		const r = await api('api/tray', { item: item.item, button });
		if (r.opened) openViewer({ hwnd: r.opened, title: r.title || item.name.split('\n')[0], fit: false });
		else toast(t('opened'), true);
	} catch (err) {
		toast(err.message, true);
	}
}

function openPort(port) {
	if (!linked) return window.open(`port/${port}/`, '_blank', 'noopener');
	// Through handide: its preview shows the app (handide forwards localhost ports itself).
	if (window.parent !== window) window.parent.postMessage({ handremote: 'openPort', port }, location.origin);
	else location.href = `/__handide/port/${port}/`;
}

async function showProc(s) {
	$('sheet-title').textContent = `${s.name} · pid ${s.pid}`;
	const body = $('sheet-body');
	body.replaceChildren(h('dt', {}, t('ports')), h('dd', {}, s.ports.map((p) => `${p.port}${p.local ? ' (127.0.0.1)' : ''}`).join(', ')));
	$('sheet').hidden = false;
	try {
		const p = await api(`api/proc?pid=${s.pid}`);
		const add = (k, v) => v && body.append(h('dt', {}, t(k)), h('dd', {}, v));
		add('path', p.path);
		add('cmd', p.cmd);
		add('started', p.start ? new Date(p.start).toLocaleString() : null);
		add('memory', p.mem ? mb(p.mem) : null);
	} catch {}
}
$('sheet-close').addEventListener('click', () => ($('sheet').hidden = true));
$('sheet').addEventListener('click', (e) => e.target === $('sheet') && ($('sheet').hidden = true));

// ---------------------------------------------------------------- viewer

const viewer = { ws: null, hwnd: null, fitted: false, viewOnly: false, drag: false, auto: false, url: null, frame: null, mods: new Set() };

function stageSize() {
	const r = $('stage').getBoundingClientRect();
	return { w: Math.round(r.width), h: Math.round(r.height) };
}

function openViewer({ hwnd, title, fit, auto = false }) {
	if (viewer.ws) closeViewer(true);
	$('viewer').hidden = false;
	$('v-title').textContent = title || '';
	$('v-sas').hidden = hwnd !== 0;
	$('v-fit').hidden = hwnd === 0;
	$('screen').removeAttribute('src');
	Object.assign(viewer, { hwnd, auto, fitted: false, viewOnly: false, mods: new Set() });
	renderKeys();
	// The phone's back gesture closes the window view instead of leaving the page.
	if (!history.state?.viewer) history.pushState({ viewer: true }, '');
	// The size the window gets: the stage, once the viewer is laid out.
	requestAnimationFrame(() => {
		const size = stageSize();
		const url = new URL(`api/view?hwnd=${hwnd}&fit=${fit ? 1 : 0}&w=${size.w}&h=${size.h}`, location.href);
		url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const ws = new WebSocket(url);
		ws.binaryType = 'blob';
		viewer.ws = ws;
		ws.onmessage = (e) => {
			if (typeof e.data !== 'string') return showFrame(e.data);
			const m = JSON.parse(e.data);
			if (m.t === 'ready') {
				viewer.viewOnly = m.viewOnly;
				viewer.fitted = m.fitted;
				updateFit();
				if (m.viewOnly) toast(t('err.view-only'));
			} else if (m.t === 'frame') viewer.frame = m;
			else if (m.t === 'fitted') ((viewer.fitted = m.fitted), updateFit());
			else if (m.t === 'gone') (toast(t('gone'), true), closeViewer());
			else if (m.t === 'error') {
				const key = `err.${m.code}`;
				toast(m.code && (S[key] || STRINGS.en[key]) ? t(key) : m.msg);
			}
		};
		ws.onclose = () => viewer.ws === ws && closeViewer();
	});
	schedule();
}

function showFrame(blob) {
	const img = $('screen');
	const url = URL.createObjectURL(blob);
	const prev = viewer.url;
	viewer.url = url;
	img.onload = () => prev && URL.revokeObjectURL(prev);
	img.src = url;
}

/** replacing: another window opens right away; fromHistory: the back gesture already went back. */
function closeViewer(replacing = false, fromHistory = false) {
	const ws = viewer.ws;
	viewer.ws = null;
	ws?.close();
	if (viewer.url) URL.revokeObjectURL(viewer.url);
	viewer.url = null;
	if (replacing) return;
	viewer.hwnd = null;
	$('viewer').hidden = true;
	if (!fromHistory && history.state?.viewer) history.back();
	refresh();
	schedule();
}
window.addEventListener('popstate', () => !$('viewer').hidden && closeViewer(false, true));

$('v-close').addEventListener('click', () => closeViewer());
function updateFit() {
	$('v-fit').textContent = viewer.fitted ? t('fitOrig') : t('fitPhone');
	$('v-fit').hidden = viewer.hwnd === 0 || viewer.viewOnly;
}
$('v-fit').addEventListener('click', () => send(viewer.fitted ? { t: 'nofit' } : { t: 'fit', ...stageSize() }));
$('v-drag').addEventListener('click', () => {
	viewer.drag = !viewer.drag;
	$('v-drag').setAttribute('aria-pressed', String(viewer.drag));
});
$('v-sas').addEventListener('click', () => send({ t: 'sas' }));

function send(msg) {
	if (viewer.ws?.readyState === 1) viewer.ws.send(JSON.stringify(msg));
}

let toastTimer = null;
function toast(text, short = false) {
	const el = $('toast');
	el.textContent = text;
	el.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (el.hidden = true), short ? 2000 : 4500);
}

// ---------------------------------------------------------------- keys and text

const KEYS = [
	['Esc', 27], ['Tab', 9], ['⌫', 8], ['Del', 46], ['Enter', 13], ['←', 37], ['↑', 38], ['↓', 40], ['→', 39],
	['Ctrl', 'ctrl'], ['Alt', 'alt'], ['Shift', 'shift'], ['Win', 'win'], ['Home', 36], ['End', 35], ['PgUp', 33], ['PgDn', 34], ['F5', 116],
];

function renderKeys() {
	$('keys').replaceChildren(
		...KEYS.map(([label, code]) => {
			const sticky = typeof code === 'string';
			return h('button', {
				type: 'button',
				'aria-pressed': sticky ? String(viewer.mods.has(code)) : null,
				onclick: (e) => {
					if (sticky) {
						viewer.mods.has(code) ? viewer.mods.delete(code) : viewer.mods.add(code);
						e.currentTarget.setAttribute('aria-pressed', String(viewer.mods.has(code)));
						return;
					}
					sendKey(code);
				},
			}, label);
		}),
	);
}

function takeMods() {
	const mods = [...viewer.mods].join(',');
	if (viewer.mods.size) {
		viewer.mods.clear();
		renderKeys();
	}
	return mods;
}

function sendKey(vk) {
	send({ t: 'key', vk, mods: takeMods() });
}

$('typebar').addEventListener('submit', (e) => {
	e.preventDefault();
	const input = $('type');
	const text = input.value;
	if (!text) return sendKey(13);
	// With Ctrl/Alt/Win held, one letter is a shortcut (Ctrl+S), not text.
	if (viewer.mods.size && /^[a-z0-9]$/i.test(text)) send({ t: 'key', vk: text.toUpperCase().charCodeAt(0), mods: takeMods() });
	else send({ t: 'text', s: text });
	input.value = '';
});

// ---------------------------------------------------------------- gestures on the window

const stage = $('stage');
const pointers = new Map();
let gesture = null;

function at(e) {
	const r = $('screen').getBoundingClientRect();
	return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
}

stage.addEventListener('pointerdown', (e) => {
	if (!$('screen').src) return;
	stage.setPointerCapture(e.pointerId);
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	if (pointers.size > 1) {
		clearTimeout(gesture?.timer);
		gesture = { kind: 'scroll', x: avg('x'), y: avg('y'), acc: [0, 0] };
		return;
	}
	const p = at(e);
	gesture = { kind: 'pending', x: e.clientX, y: e.clientY, start: p, acc: [0, 0] };
	gesture.timer = setTimeout(() => {
		if (gesture?.kind !== 'pending') return;
		gesture.kind = 'held';
		navigator.vibrate?.(15);
		if (p.inside) send({ t: 'mouse', a: 'right', ...p });
	}, 550);
});

const avg = (k) => [...pointers.values()].reduce((s, p) => s + p[k], 0) / pointers.size;

let wheelTimer = null;
function flushWheel() {
	wheelTimer = null;
	if (!gesture || gesture.kind !== 'scroll') return;
	const [dx, dy] = gesture.acc;
	gesture.acc = [0, 0];
	// 120 is one wheel notch; ~40 px of finger travel per notch feels like a phone.
	const wy = Math.round(dy * 3);
	const wx = Math.round(-dx * 3);
	if (wy || wx) send({ t: 'mouse', a: 'wheel', fx: gesture.fx ?? 0.5, fy: gesture.fy ?? 0.5, dy: wy, dx: wx });
}

stage.addEventListener('pointermove', (e) => {
	if (!pointers.has(e.pointerId) || !gesture) return;
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	const x = avg('x');
	const y = avg('y');
	if (gesture.kind === 'pending' && Math.hypot(x - gesture.x, y - gesture.y) > 10) {
		clearTimeout(gesture.timer);
		if (viewer.drag) {
			gesture.kind = 'drag';
			send({ t: 'mouse', a: 'down', ...gesture.start });
		} else {
			gesture.kind = 'scroll';
			Object.assign(gesture, { fx: gesture.start.fx, fy: gesture.start.fy });
		}
	}
	if (gesture.kind === 'scroll') {
		gesture.acc[0] += x - gesture.x;
		gesture.acc[1] += y - gesture.y;
		if (gesture.fx == null) Object.assign(gesture, at({ clientX: x, clientY: y }));
		if (!wheelTimer) wheelTimer = setTimeout(flushWheel, 50);
	} else if (gesture.kind === 'drag') {
		const now = Date.now();
		if (!gesture.sent || now - gesture.sent > 30) {
			gesture.sent = now;
			send({ t: 'mouse', a: 'move', ...at(e) });
		}
	}
	gesture.x = x;
	gesture.y = y;
});

function endPointer(e) {
	if (!pointers.has(e.pointerId)) return;
	pointers.delete(e.pointerId);
	if (pointers.size || !gesture) return;
	clearTimeout(gesture.timer);
	if (gesture.kind === 'pending' && gesture.start.inside && e.type === 'pointerup') send({ t: 'mouse', a: 'click', ...gesture.start });
	else if (gesture.kind === 'drag') send({ t: 'mouse', a: 'up', ...at(e) });
	else if (gesture.kind === 'scroll') flushWheel();
	gesture = null;
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

// Orientation changes: lay the window out again for the new stage.
let lastStage = null;
window.addEventListener('resize', () => {
	if (!viewer.ws || !viewer.fitted) return;
	const s = stageSize();
	// The keyboard opening shrinks the stage: only a turn of the phone (width) relays it out.
	if (lastStage && Math.abs(s.w - lastStage.w) > 40) send({ t: 'fit', ...s });
	lastStage = s;
});

refresh().then(schedule);
