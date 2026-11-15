// handremote phone UI: the PC's windows, widgets, tray icons, web apps and servers by
// category; a tapped window opens at the phone's size and takes taps, scrolls and text.
// Every URL is relative, so the same page works at "/" (standalone) and at
// "/__handide/screen/" (opened through handide).
'use strict';

const STRINGS = {
	ko: {
		dlDone: '다운로드 완료', dlOpen: '열기', dlFolder: '폴더에서 보기', dlLater: '닫기', dlWaiting: 'PC에서 여는 중…', micOn: '마이크 켜짐 · PC에서 "CABLE Output"을 마이크로 고르세요', micOff: '마이크 꺼짐', micDenied: '마이크 권한이 거부되었습니다', micGuideTitle: 'PC에 가상 마이크 드라이버가 필요합니다', micGuide: 'Windows는 프로그램이 마이크를 만들 수 없어서, 무료 가상 오디오 케이블(VB-CABLE)을 PC에 한 번 설치해야 합니다.', micStep1: 'PC에서 vb-audio.com/Cable 을 열어 VB-CABLE Driver를 받습니다.', micStep2: '압축을 풀고 VBCABLE_Setup_x64.exe를 오른쪽 클릭 → 관리자 권한으로 실행 → Install Driver.', micStep3: 'PC를 다시 시작합니다.', micStep4: '통화·녹음 프로그램에서 마이크를 "CABLE Output"(Hi-Fi Cable이면 "Hi-Fi Cable Output")으로 고릅니다.', micCopy: '주소 복사', micCopied: '주소를 복사했습니다', soundOff: '무음', soundWindow: '이 창 소리', soundAll: '전체 소리', soundFailed: '소리를 가져오지 못했습니다', back: '‹ 목록', close: '닫기', closeOne: '이 창 닫기', closeAll: '{proc} 창 {n}개 모두 닫기', closeHint: '저장하지 않은 내용이 있으면 PC에서 저장할지 묻는 창이 뜹니다.', closed: '창 {n}개에 닫기를 보냈습니다', closeFailed: '창 {n}개는 닫지 못했습니다',
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
		dlDone: 'Download finished', dlOpen: 'Open', dlFolder: 'Show in folder', dlLater: 'Close', dlWaiting: 'Opening on the PC…', micOn: 'Microphone on · pick "CABLE Output" as the microphone on the PC', micOff: 'Microphone off', micDenied: 'Microphone access was denied', micGuideTitle: 'The PC needs a virtual microphone driver', micGuide: 'Windows does not let a program add a microphone, so a free virtual audio cable (VB-CABLE) has to be installed on the PC once.', micStep1: 'On the PC, open vb-audio.com/Cable and download the VB-CABLE Driver.', micStep2: 'Unzip it, right-click VBCABLE_Setup_x64.exe → Run as administrator → Install Driver.', micStep3: 'Restart the PC.', micStep4: 'In the call or recording app, pick "CABLE Output" (with Hi-Fi Cable: "Hi-Fi Cable Output") as the microphone.', micCopy: 'Copy address', micCopied: 'Address copied', soundOff: 'Muted', soundWindow: 'This window', soundAll: 'Whole PC', soundFailed: 'Could not get the sound', back: '‹ List', close: 'Close', closeOne: 'Close this window', closeAll: 'Close all {n} {proc} windows', closeHint: 'An app with unsaved work asks on the PC whether to save it.', closed: 'Asked {n} window(s) to close', closeFailed: '{n} window(s) could not be closed',
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
		dlDone: 'ダウンロード完了', dlOpen: '開く', dlFolder: 'フォルダーで表示', dlLater: '閉じる', dlWaiting: 'PC で開いています…', micOn: 'マイク オン · PC で「CABLE Output」をマイクに選んでください', micOff: 'マイク オフ', micDenied: 'マイクの許可が拒否されました', micGuideTitle: 'PC に仮想マイクのドライバーが必要です', micGuide: 'Windows ではプログラムがマイクを追加できないため、無料の仮想オーディオケーブル (VB-CABLE) を PC に一度インストールします。', micStep1: 'PC で vb-audio.com/Cable を開き、VB-CABLE Driver をダウンロードします。', micStep2: '展開して VBCABLE_Setup_x64.exe を右クリック → 管理者として実行 → Install Driver。', micStep3: 'PC を再起動します。', micStep4: '通話・録音アプリでマイクを「CABLE Output」(Hi-Fi Cable なら「Hi-Fi Cable Output」)にします。', micCopy: 'アドレスをコピー', micCopied: 'アドレスをコピーしました', soundOff: 'ミュート', soundWindow: 'このウィンドウの音', soundAll: 'PC 全体の音', soundFailed: '音を取得できませんでした', back: '‹ 一覧', close: '閉じる', closeOne: 'このウィンドウを閉じる', closeAll: '{proc} のウィンドウ {n} 個をすべて閉じる', closeHint: '保存していない内容があると、PC で保存するか確認されます。', closed: '{n} 個のウィンドウに閉じる指示を送りました', closeFailed: '{n} 個のウィンドウは閉じられませんでした',
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
		dlDone: '下载完成', dlOpen: '打开', dlFolder: '在文件夹中显示', dlLater: '关闭', dlWaiting: '正在电脑上打开…', micOn: '麦克风已开 · 在电脑上选择 "CABLE Output" 作为麦克风', micOff: '麦克风已关', micDenied: '麦克风权限被拒绝', micGuideTitle: '电脑需要虚拟麦克风驱动', micGuide: 'Windows 不允许程序添加麦克风，需要在电脑上安装一次免费的虚拟音频线 (VB-CABLE)。', micStep1: '在电脑上打开 vb-audio.com/Cable，下载 VB-CABLE Driver。', micStep2: '解压后右键 VBCABLE_Setup_x64.exe → 以管理员身份运行 → Install Driver。', micStep3: '重启电脑。', micStep4: '在通话或录音软件中把麦克风选为 "CABLE Output"（Hi-Fi Cable 则为 "Hi-Fi Cable Output"）。', micCopy: '复制地址', micCopied: '地址已复制', soundOff: '静音', soundWindow: '此窗口声音', soundAll: '全部声音', soundFailed: '无法获取声音', back: '‹ 列表', close: '关闭', closeOne: '关闭此窗口', closeAll: '关闭全部 {n} 个 {proc} 窗口', closeHint: '有未保存内容的应用会在电脑上询问是否保存。', closed: '已让 {n} 个窗口关闭', closeFailed: '{n} 个窗口未能关闭',
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
const mb = (n) => (n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(1)} GB` : n >= 1 << 20 ? `${Math.round(n / (1 << 20))} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

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
	const open = row({ hwnd: w.hwnd, icon: windowIcon(w), title: w.title || w.proc || w.cls, sub: usage, badges, onTap: () => openViewer({ hwnd: w.hwnd, title: w.title || w.proc, fit: true }) });
	if (w.viewOnly) return open;
	const close = h('button', { type: 'button', class: 'row-close', 'aria-label': t('close'), onclick: () => askClose(w) }, '✕');
	return h('div', { class: 'row-wrap' }, open, close);
}

// ✕ on a window: close it, or every window of the same program.
function askClose(w) {
	const same = (last?.windows || []).filter((x) => x.proc && x.proc === w.proc && !x.viewOnly);
	const fill = (s) => s.replace('{n}', String(same.length)).replace('{proc}', w.proc || '');
	$('sheet-title').textContent = w.title || w.proc || '';
	const action = (label, hwnds, cls = '') =>
		h('button', { type: 'button', class: `sheet-act ${cls}`, onclick: () => (($('sheet').hidden = true), closeWindows(hwnds)) }, label);
	$('sheet-body').replaceChildren(
		h('div', { class: 'sheet-acts' }, action(t('closeOne'), [w.hwnd], 'danger'), same.length > 1 ? action(fill(t('closeAll')), same.map((x) => x.hwnd), 'danger') : null),
		h('p', { class: 'sheet-hint' }, t('closeHint')),
	);
	$('sheet').hidden = false;
}

async function closeWindows(hwnds) {
	try {
		const r = await api('api/close', { hwnds });
		toast(r.failed.length ? t('closeFailed').replace('{n}', String(r.failed.length)) : t('closed').replace('{n}', String(r.closed)), true);
	} catch (err) {
		toast(err.message, true);
	}
	setTimeout(refresh, 700);
}

function render(data) {
	last = data;
	noticeDownloads(data);
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
				noticeDownloads(s);
				if (s.helper?.secure && viewer.hwnd !== 0) openViewer({ hwnd: 0, title: t('secure'), fit: false, auto: true });
				if (!s.helper?.secure && viewer.hwnd === 0 && viewer.auto) closeViewer();
			} catch {}
		} else await refresh();
		schedule();
	}, viewer.ws ? 2000 : 3000);
}
// Leaving the page (home screen, another app, screen off) lets go of the window, so the PC
// window gets its size back while nobody uses it; coming back opens it again the same way.
function pauseViewer() {
	stopMic();
	if (!viewer.ws || viewer.hwnd == null || viewer.auto) return;
	viewer.paused = { hwnd: viewer.hwnd, title: $('v-title').textContent, fit: viewer.fitted };
	const ws = viewer.ws;
	viewer.ws = null;
	ws.close();
}
function resumeViewer() {
	const p = viewer.paused;
	viewer.paused = null;
	if (p && !$('viewer').hidden) openViewer(p);
}
document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		clearTimeout(polling);
		pauseViewer();
	} else if (viewer.paused) {
		resumeViewer();
	} else {
		refresh();
		schedule();
	}
});
window.addEventListener('pagehide', pauseViewer);
// Through handide: its preview can be hidden (another view) with this page still loaded.
window.addEventListener('message', (e) => {
	if (e.origin !== location.origin || e.data?.handide !== 'preview') return;
	if (e.data.visible) resumeViewer();
	else pauseViewer();
});
window.addEventListener('pageshow', (e) => e.persisted && resumeViewer());
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

function openViewer({ hwnd, title, fit, auto = false, parent = null }) {
	if (viewer.ws) closeViewer(true);
	$('viewer').hidden = false;
	$('v-title').textContent = title || '';
	$('v-sas').hidden = hwnd !== 0;
	$('v-fit').hidden = hwnd === 0;
	$('screen').removeAttribute('src');
	Object.assign(viewer, { hwnd, auto, parent, fitted: false, viewOnly: false, mods: new Set() });
	renderKeys();
	if (sound.mode !== 'off') soundContext(); // opened from a tap: the moment audio may start
	// The phone's back gesture closes the window view instead of leaving the page.
	if (!history.state?.viewer) history.pushState({ viewer: true }, '');
	// The size the window gets: the stage, once the viewer is laid out.
	requestAnimationFrame(() => {
		const size = stageSize();
		const url = new URL(`api/view?hwnd=${hwnd}&fit=${fit ? 1 : 0}&w=${size.w}&h=${size.h}`, location.href);
		url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const ws = new WebSocket(url);
		ws.binaryType = 'arraybuffer';
		viewer.ws = ws;
		ws.onmessage = (e) => {
			if (typeof e.data !== 'string') {
				const bytes = new Uint8Array(e.data);
				if (bytes[0] === 0x41) return playSound(e.data);
				return showFrame(new Blob([e.data], { type: 'image/jpeg' }));
			}
			const m = JSON.parse(e.data);
			if (m.t === 'ready') {
				viewer.viewOnly = m.viewOnly;
				viewer.fitted = m.fitted;
				updateFit();
				if (sound.mode !== 'off') ws.send(JSON.stringify({ t: 'sound', mode: sound.mode }));
				if (m.viewOnly) toast(t('err.view-only'));
			} else if (m.t === 'frame') viewer.frame = m;
			else if (m.t === 'fitted') ((viewer.fitted = m.fitted), updateFit());
			else if (m.t === 'sound' && m.error) (toast(t('soundFailed'), true), console.warn(m.error));
			else if (m.t === 'mic') micAnswer(m);
			else if (m.t === 'gone') {
				// A dialog it followed closed: back to the window that opened it.
				const back = viewer.parent;
				if (back) openViewer(back);
				else (toast(t('gone'), true), closeViewer());
			} else if (m.t === 'popup' && m.hwnd !== viewer.hwnd) {
				// The window opened a dialog (Save As…) and waits on it: show the dialog.
				openViewer({ hwnd: m.hwnd, title: m.title, fit: true, parent: viewer.parent || { hwnd: viewer.hwnd, title: $('v-title').textContent, fit: viewer.fitted } });
			}
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
	viewer.paused = null;
	stopMic();
	const ws = viewer.ws;
	viewer.ws = null;
	ws?.close();
	if (viewer.url) URL.revokeObjectURL(viewer.url);
	viewer.url = null;
	if (replacing) return;
	viewer.hwnd = null;
	closeDrawer();
	$('viewer').hidden = true;
	if (!fromHistory && history.state?.viewer) history.back();
	refresh();
	schedule();
}
window.addEventListener('popstate', () => !$('viewer').hidden && closeViewer(false, true));

$('v-close').addEventListener('click', () => closeViewer());

// ---------------------------------------------------------------- finished downloads
// A download that finished on the PC: say so, and offer to open it or show it in its folder.
// The window that opens is shown right away. Times are the PC's (the phone's clock may differ).
let downloadsSeen = null;
// Opened from a notification (handide adds ?download=<id>): that download's choices first.
let askedDownload = Number(new URLSearchParams(location.search).get('download')) || null;
function noticeDownloads(data) {
	const list = data?.downloads;
	if (!list || data.now == null) return;
	if (askedDownload) {
		const d = list.find((x) => x.id === askedDownload);
		askedDownload = null;
		if (d) showDownload(d);
	}
	if (downloadsSeen == null) return void (downloadsSeen = data.now - 3000); // what finished before this page opened is old
	const fresh = list.filter((d) => d.at > downloadsSeen);
	if (!fresh.length) return;
	downloadsSeen = Math.max(...fresh.map((d) => d.at));
	showDownload(fresh[fresh.length - 1]);
}

// A banner from the top, like a phone notification; it goes away by itself.
let bannerTimer = null;
function showDownload(d) {
	navigator.vibrate?.([30, 60, 30]);
	document.getElementById('banner')?.remove();
	const close = () => {
		clearTimeout(bannerTimer);
		banner.classList.remove('in');
		setTimeout(() => banner.remove(), 250);
	};
	const act = (label, how, cls = '') => h('button', { type: 'button', class: `banner-act ${cls}`, onclick: () => (close(), openDownload(d, how)) }, label);
	const banner = h(
		'div',
		{ id: 'banner', role: 'alert' },
		h('div', { class: 'banner-text' }, h('b', {}, `⬇ ${t('dlDone')}`), h('span', {}, d.name), h('small', {}, mb(d.size))),
		h('div', { class: 'banner-acts' }, act(t('dlOpen'), 'open', 'primary'), act(t('dlFolder'), 'folder'), h('button', { type: 'button', class: 'banner-act', 'aria-label': t('dlLater'), onclick: close }, '✕')),
	);
	document.body.append(banner);
	requestAnimationFrame(() => banner.classList.add('in'));
	clearTimeout(bannerTimer);
	bannerTimer = setTimeout(close, 10000);
}

async function openDownload(d, how) {
	const before = new Set((last?.windows || []).map((w) => w.hwnd));
	toast(t('dlWaiting'), true);
	try {
		await api('api/download/open', { id: d.id, how });
	} catch (err) {
		return toast(err.message, true);
	}
	// The window it opened (Explorer, an installer…): the newest one that was not there before.
	for (let i = 0; i < 16; i++) {
		await new Promise((r) => setTimeout(r, 400));
		let data;
		try {
			data = await api('api/list');
		} catch {
			continue;
		}
		last = data;
		const added = data.windows.filter((w) => !before.has(w.hwnd) && (w.kind === 'app' || w.kind === 'widget'));
		const w = added.find((x) => x.fg) || added[0];
		if (w) return openViewer({ hwnd: w.hwnd, title: w.title || w.proc, fit: true });
	}
	if (!viewer.ws) refresh();
}

// ---------------------------------------------------------------- sound
// Like a phone's ring/vibrate/silent switch: one button, tapped round
// muted → this window's program → the whole PC → muted. Kept for the next window.
const SOUND_MODES = ['off', 'window', 'all'];
const SOUND_FACE = { off: ['🔇', 'soundOff'], window: ['🔉', 'soundWindow'], all: ['🔊', 'soundAll'] };
const sound = { mode: 'off', ctx: null, at: 0 };
try {
	const saved = localStorage.getItem('handremote.sound');
	if (SOUND_MODES.includes(saved)) sound.mode = saved;
} catch {}

function renderSound() {
	const [face, label] = SOUND_FACE[sound.mode];
	const b = $('v-sound');
	b.textContent = face;
	b.setAttribute('aria-label', t(label));
	b.title = t(label);
	b.dataset.mode = sound.mode;
}

/** Audio may only start inside a tap on iPhones: called from the taps that turn it on. */
function soundContext() {
	if (!sound.ctx) {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		sound.ctx = new AC();
	}
	// Play through the silent switch, as a video does.
	try {
		if (navigator.audioSession) navigator.audioSession.type = 'playback';
	} catch {}
	if (sound.ctx.state !== 'running') sound.ctx.resume().catch(() => {});
	return sound.ctx;
}

$('v-sound').addEventListener('click', () => {
	sound.mode = SOUND_MODES[(SOUND_MODES.indexOf(sound.mode) + 1) % SOUND_MODES.length];
	try {
		localStorage.setItem('handremote.sound', sound.mode);
	} catch {}
	renderSound();
	toast(t(SOUND_FACE[sound.mode][1]), true);
	if (sound.mode !== 'off') soundContext();
	sound.at = 0;
	if (viewer.ws?.readyState === 1) viewer.ws.send(JSON.stringify({ t: 'sound', mode: sound.mode }));
});
renderSound();
// Back from the home screen the audio is suspended: the next touch starts it again.
document.addEventListener('pointerdown', () => sound.mode !== 'off' && sound.ctx && sound.ctx.state !== 'running' && soundContext(), true);

// ---------------------------------------------------------------- microphone
// The phone's microphone into PC programs, through the VB-CABLE driver on the PC (the PC's
// "CABLE Output" microphone). On until tapped off, the window closed or the page left.
const mic = { on: false, stream: null, ctx: null, node: null, src: null };

function renderMic() {
	const b = $('v-mic');
	b.setAttribute('aria-pressed', String(mic.on));
	b.setAttribute('aria-label', t(mic.on ? 'micOn' : 'micOff'));
}

async function startMic() {
	if (!viewer.ws || viewer.ws.readyState !== 1) return;
	try {
		mic.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
	} catch {
		return toast(t('micDenied'), true);
	}
	const AC = window.AudioContext || window.webkitAudioContext;
	mic.ctx = new AC();
	if (mic.ctx.state !== 'running') mic.ctx.resume().catch(() => {});
	mic.src = mic.ctx.createMediaStreamSource(mic.stream);
	mic.node = mic.ctx.createScriptProcessor(2048, 1, 1);
	const ratio = mic.ctx.sampleRate / 24000;
	mic.node.onaudioprocess = (e) => {
		const ws = viewer.ws;
		if (!mic.on || !ws || ws.readyState !== 1 || ws.bufferedAmount > 64 * 1024) return;
		const input = e.inputBuffer.getChannelData(0);
		const n = Math.floor(input.length / ratio);
		// "M" in the first byte, then the samples
		const bytes = new Uint8Array(1 + n * 2);
		bytes[0] = 0x4d;
		const view = new DataView(bytes.buffer);
		for (let i = 0; i < n; i++) {
			const v = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
			view.setInt16(1 + i * 2, v * 32767, true);
		}
		ws.send(bytes);
	};
	mic.src.connect(mic.node);
	mic.node.connect(mic.ctx.destination); // a processor only runs when connected; it outputs silence
	mic.on = true;
	renderMic();
	viewer.ws.send(JSON.stringify({ t: 'mic', on: true }));
}

function stopMic(tell = true) {
	const was = mic.on;
	mic.on = false;
	try {
		mic.node?.disconnect();
		mic.src?.disconnect();
	} catch {}
	mic.stream?.getTracks().forEach((tr) => tr.stop());
	mic.ctx?.close().catch(() => {});
	Object.assign(mic, { stream: null, ctx: null, node: null, src: null });
	renderMic();
	if (was && tell && viewer.ws?.readyState === 1) viewer.ws.send(JSON.stringify({ t: 'mic', on: false }));
}

function micAnswer(m) {
	if (m.error === 'no-cable') {
		stopMic(false);
		return showMicGuide();
	}
	if (m.error) {
		stopMic(false);
		return toast(m.msg || m.error, true);
	}
	if (m.on) toast(t('micOn'));
}

function showMicGuide() {
	$('sheet-title').textContent = t('micGuideTitle');
	const url = 'https://vb-audio.com/Cable/';
	$('sheet-body').replaceChildren(
		h('p', { class: 'sheet-hint' }, t('micGuide')),
		h('ol', { class: 'sheet-steps' }, ['micStep1', 'micStep2', 'micStep3', 'micStep4'].map((k) => h('li', {}, t(k)))),
		h(
			'div',
			{ class: 'sheet-acts' },
			h(
				'button',
				{
					type: 'button',
					class: 'sheet-act',
					onclick: () => navigator.clipboard?.writeText(url).then(() => toast(t('micCopied'), true), () => toast(url)),
				},
				`${t('micCopy')} · ${url}`,
			),
		),
	);
	$('sheet').hidden = false;
}

$('v-mic').addEventListener('click', () => (mic.on ? stopMic() : startMic()));
renderMic();

/** One "A"-tagged message: 24 kHz mono 16-bit, played right after the previous one. */
function playSound(buf) {
	if (sound.mode === 'off') return;
	const ctx = soundContext();
	if (!ctx || ctx.state !== 'running') return;
	const pcm = new Int16Array(buf.slice(1));
	if (!pcm.length) return;
	const audio = ctx.createBuffer(1, pcm.length, 24000);
	const ch = audio.getChannelData(0);
	for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
	const src = ctx.createBufferSource();
	src.buffer = audio;
	src.connect(ctx.destination);
	const now = ctx.currentTime;
	// A small cushion against the network's unevenness; too far behind starts over.
	if (sound.at < now || sound.at > now + 0.6) sound.at = now + 0.12;
	src.start(sound.at);
	sound.at += audio.duration;
}

// ---------------------------------------------------------------- window drawer
// While a window is open: swipe left from the right edge for the other windows (half the
// screen), swipe right (or tap beside it) to close. A tap on one switches to it.
async function openDrawer() {
	const v = $('viewer');
	if (v.classList.contains('drawer-open')) return;
	v.classList.add('drawer-open');
	navigator.vibrate?.(10);
	renderDrawer(last);
	try {
		renderDrawer((last = await api('api/list')));
	} catch {}
}

function closeDrawer() {
	$('viewer').classList.remove('drawer-open');
}

function renderDrawer(data) {
	const wins = (data?.windows || []).filter((w) => w.kind === 'app' || w.kind === 'widget');
	$('drawer-head').replaceChildren(h('b', {}, t('apps')), h('small', {}, String(wins.length)));
	$('drawer-list').replaceChildren(
		...wins.map((w) =>
			h(
				'button',
				{
					type: 'button',
					class: 'drawer-row',
					'aria-current': w.hwnd === viewer.hwnd ? 'true' : null,
					onclick: () => {
						closeDrawer();
						if (w.hwnd !== viewer.hwnd) openViewer({ hwnd: w.hwnd, title: w.title || w.proc, fit: true });
					},
				},
				h('span', { class: 'ico' }, windowIcon(w)),
				h('span', { class: 'txt' }, h('span', { class: 't1' }, w.title || w.proc || w.cls), h('span', { class: 't2' }, w.proc || '')),
			),
		),
	);
}

$('drawer-scrim').addEventListener('click', closeDrawer);
{
	let from = null;
	const drawer = $('drawer');
	drawer.addEventListener('pointerdown', (e) => (from = { x: e.clientX, y: e.clientY }));
	drawer.addEventListener('pointermove', (e) => {
		if (!from) return;
		const dx = e.clientX - from.x;
		if (dx > 50 && dx > Math.abs(e.clientY - from.y)) ((from = null), closeDrawer());
	});
	const end = () => (from = null);
	drawer.addEventListener('pointerup', end);
	drawer.addEventListener('pointercancel', end);
}
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
const EDGE = 28;
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
	// From the right edge: a swipe to the left opens the window drawer (a tap there still clicks).
	const edge = e.clientX > stage.getBoundingClientRect().right - EDGE;
	gesture = { kind: 'pending', x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, edge, start: p, acc: [0, 0] };
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
	if (gesture.kind === 'edge') {
		if (gesture.ox - x > 40) ((gesture.kind = 'done'), openDrawer());
		return;
	}
	if (gesture.kind === 'done') return;
	if (gesture.kind === 'pending' && Math.hypot(x - gesture.x, y - gesture.y) > 10) {
		clearTimeout(gesture.timer);
		if (gesture.edge && pointers.size === 1 && gesture.ox - x > Math.abs(y - gesture.oy)) {
			gesture.kind = 'edge';
			return;
		}
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
