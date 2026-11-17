// handremote phone UI: the PC's windows, widgets, tray icons, web apps and servers by
// category; a tapped window opens at the phone's size and takes taps, scrolls and text.
// Every URL is relative, so the same page works at "/" (standalone) and at
// "/__handide/screen/" (opened through handide).
'use strict';

const STRINGS = {
	ko: {
		micOnPick: '마이크 켜짐 · PC의 통화·녹음 프로그램에서 마이크를 “{pick}”(으)로 고르세요', micInstall: 'PC에 설치 창 열기', micInstallHint: 'PC가 vb-audio.com에서 공식 패키지를 받아 제작자 서명을 확인한 뒤 설치 창을 그대로 엽니다. 관리자 확인에서 “예”를 누르고(SYSTEM 도우미가 있으면 폰에서도 됩니다), 설치 창에서 Install Driver를 누른 뒤 PC를 다시 시작하세요.', micManual: '직접 설치하려면:', 'mic.downloading': '공식 사이트에서 받는 중…', 'mic.verifying': '제작자 서명을 확인하는 중…', 'mic.asking': 'PC에서 관리자 확인을 기다리는 중…', 'mic.opened': 'PC에 설치 창을 열었습니다. Install Driver를 누른 뒤 PC를 다시 시작하세요.', 'mic.ready': '받았고 서명도 확인했습니다', 'mic.failed': '열지 못했습니다: {error}', 'mic.cancelled': '관리자 확인이 취소되었습니다', modeTouch: '터치: 탭=클릭 · 끌기=스크롤 · 두 손가락 벌리기=확대', modeDrag: '드래그: 끌어서 선택하거나 옮깁니다', modePointer: '포인터: 끌어서 커서 이동 · 탭=클릭 · 길게=오른쪽 클릭 · 길게 누른 뒤 끌기=드래그', zoomReset: '원래 크기로', diag: '연결 상태', diagRun: '다시 측정', diagMeasuring: '측정하는 중…', dgPath: '연결 경로', dgLan: '같은 Wi‑Fi (직접)', dgTsDirect: 'Tailscale · 직접 연결', dgTsRelay: 'Tailscale · 중계 서버 경유 ({relay})', dgTs: 'Tailscale', dgHandide: 'handide 경유', dgLocal: '이 PC', dgRtt: '응답 시간', dgDown: '받기 속도', dgUp: '보내기 속도', dgParts: 'PC 구성 요소', dgFrames: '화면', dgControl: '조작', dgSound: '소리', dgHelper: 'SYSTEM 도우미', dgHelperNo: '설치 안 됨', dgHelperDown: '응답 없음', dgRemote: '밖에서 접속', dgService: 'PC 켤 때 자동 실행', dgOn: '켜짐', dgOff: '꺼짐', dgTurnOn: '켜기', dgTurnOff: '끄기', dgStream: '화면 전송', dgStreamVal: '화질 {q} · 크기 {s}% · 초당 {fps}장 · 한 장 {kb} KB', dgVersion: '버전', dgUptime: '실행 시간', dgGood: '문제 없음', dgOffline: 'PC에 연결할 수 없습니다', dgOff1: 'PC가 켜져 있고 Windows에 로그인되어 있는지 확인하세요.', dgOff2: '집 밖이면 폰의 Tailscale이 켜져 있어야 합니다. 집에서는 PC와 같은 Wi‑Fi인지 확인하세요.', dgOff3: 'PC에서 handremote가 실행 중이어야 합니다. ‘PC 켤 때 자동 실행’을 켜 두면 재부팅 뒤에도 알아서 켜집니다.', adRelay: 'Tailscale이 직접 연결하지 못해 중계 서버를 거칩니다. 느릴 수 있습니다. 집에서는 같은 Wi‑Fi로 연결하세요.', adSlowRtt: '응답이 느립니다. 화면이 늦게 따라오고 화질이 자동으로 낮아집니다.', adSlowDown: '받기 속도가 낮아 화질과 크기가 자동으로 낮아집니다.', adPart: 'PC의 ‘{name}’ 부분이 응답하지 않습니다. 잠시 뒤 다시 측정하거나 handremote를 다시 시작하세요.', adService: 'PC를 다시 켜면 handremote가 자동으로 켜지지 않습니다.', adRemote: '밖에서는 접속할 수 없습니다: {reason}', dgHandover: '자동 실행으로 넘기는 중… 몇 초 뒤 다시 연결됩니다', devices: '기기', devicesTitle: '연결된 기기', dThis: '이 기기', dSeen: '최근 사용', pControl: '조작', pFiles: '파일', pTerm: '터미널', pAdmin: '관리', dLook: '보기는 항상 됩니다', dRename: '이름 바꾸기', dRemove: '연결 해제', dRemoveAsk: '"{name}"의 연결을 끊을까요? 다시 쓰려면 새로 연결해야 합니다.', dRemoved: '연결을 해제했습니다', dAdd: '기기 추가', dAddTitle: '새 기기에 줄 권한', dAddHint: '초대 링크는 10분 동안 한 번만 쓸 수 있습니다.', dMake: '초대 링크 만들기', dInviteHint: '새 기기의 카메라로 QR을 찍거나 링크를 보내세요. {time}까지 유효합니다.', dCopy: '링크 복사', dCopied: '링크를 복사했습니다', dRotate: 'PC 링크 바꾸기', dRotateAsk: '지금까지 나눠 준 QR 코드와 링크로는 새 기기를 더 연결할 수 없게 됩니다. 이미 연결된 기기는 그대로입니다. 바꿀까요?', dRotated: 'PC 링크를 바꿨습니다. 새 QR 코드는 PC에서 localhost:9100/connect 를 열면 보입니다.', dLinked: 'handide로 연결됨 · 모든 권한', dName: '기기 이름', 'err.last-admin': '관리 권한이 있는 기기가 하나는 남아 있어야 합니다', 'err.perm-control': '이 기기는 보기만 할 수 있습니다', 'err.perm-files': '이 기기에는 파일 권한이 없습니다', 'err.perm-term': '이 기기에는 터미널 권한이 없습니다', 'err.perm-admin': '이 기기에는 관리 권한이 없습니다', fCancel: '취소', fCancelled: '올리기를 취소했습니다', vReconnect: '연결이 끊겼습니다 · 다시 연결하는 중…', vRetry: '다시 연결', vLost: 'PC에 연결할 수 없습니다', termOpen: '열린 터미널', termStart: '새로 열기', termEnd: '이 터미널 끝내기', termCurrent: '지금', term: '터미널', termEnded: '터미널이 끝났습니다', termNew: '새 터미널', termType: '명령 또는 입력 (한글 가능)', termRun: '실행', files: '파일', filesTitle: 'PC 파일', fOpen: 'PC에서 열기', fGet: '휴대폰으로 받기', fShow: '탐색기에서 보기', fUp: '휴대폰에서 올리기', fUploaded: '올렸습니다', fUploading: '올리는 중…', fEmpty: '빈 폴더입니다', fNoAccess: '이 폴더는 열 수 없습니다', fMore: '항목이 많아 일부만 표시합니다', fPlaces: '바로가기', fDrives: '드라이브', pDesktop: '바탕 화면', pDownloads: '다운로드', pDocuments: '문서', pPictures: '사진', pHome: '사용자 폴더', dlDone: '다운로드 완료', dlOpen: '열기', dlFolder: '폴더에서 보기', dlLater: '닫기', dlWaiting: 'PC에서 여는 중…', micOn: '마이크 켜짐 · PC에서 "CABLE Output"을 마이크로 고르세요', micOff: '마이크 꺼짐', micDenied: '마이크 권한이 거부되었습니다', micGuideTitle: 'PC에 가상 마이크 드라이버가 필요합니다', micGuide: 'Windows는 프로그램이 마이크를 만들 수 없어서, 무료 가상 오디오 케이블(VB-CABLE)을 PC에 한 번 설치해야 합니다.', micStep1: 'PC에서 vb-audio.com/Cable 을 열어 VB-CABLE Driver를 받습니다.', micStep2: '압축을 풀고 VBCABLE_Setup_x64.exe를 오른쪽 클릭 → 관리자 권한으로 실행 → Install Driver.', micStep3: 'PC를 다시 시작합니다.', micStep4: '통화·녹음 프로그램에서 마이크를 "CABLE Output"(Hi-Fi Cable이면 "Hi-Fi Cable Output")으로 고릅니다.', micCopy: '주소 복사', micCopied: '주소를 복사했습니다', soundOff: '무음', soundWindow: '이 창 소리', soundAll: '전체 소리', soundFailed: '소리를 가져오지 못했습니다', back: '‹ 목록', close: '닫기', closeOne: '이 창 닫기', closeAll: '{proc} 창 {n}개 모두 닫기', closeHint: '저장하지 않은 내용이 있으면 PC에서 저장할지 묻는 창이 뜹니다.', closed: '창 {n}개에 닫기를 보냈습니다', closeFailed: '창 {n}개는 닫지 못했습니다',
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
		micOnPick: 'Microphone on · in the call or recording app on the PC, pick “{pick}” as the microphone', micInstall: 'Open the setup on the PC', micInstallHint: 'The PC downloads the official package from vb-audio.com, checks it is signed by its author and opens its setup as it is. Say Yes to the administrator prompt (on the phone too with the SYSTEM helper), press Install Driver in the setup, then restart the PC.', micManual: 'To install it yourself:', 'mic.downloading': 'Downloading from the official site…', 'mic.verifying': 'Checking the author’s signature…', 'mic.asking': 'Waiting for the administrator prompt on the PC…', 'mic.opened': 'The setup is open on the PC. Press Install Driver, then restart the PC.', 'mic.ready': 'Downloaded and signature checked', 'mic.failed': 'Could not open it: {error}', 'mic.cancelled': 'The administrator prompt was cancelled', modeTouch: 'Touch: tap = click · drag = scroll · pinch = zoom', modeDrag: 'Drag: drag to select or move', modePointer: 'Pointer: drag moves the cursor · tap = click · hold = right click · hold then drag = drag', zoomReset: 'Back to 100%', diag: 'Connection', diagRun: 'Measure again', diagMeasuring: 'Measuring…', dgPath: 'Path', dgLan: 'Same Wi‑Fi (direct)', dgTsDirect: 'Tailscale · direct', dgTsRelay: 'Tailscale · through a relay ({relay})', dgTs: 'Tailscale', dgHandide: 'Through handide', dgLocal: 'This PC', dgRtt: 'Response time', dgDown: 'Download', dgUp: 'Upload', dgParts: 'Parts on the PC', dgFrames: 'Screen', dgControl: 'Control', dgSound: 'Sound', dgHelper: 'SYSTEM helper', dgHelperNo: 'not installed', dgHelperDown: 'not answering', dgRemote: 'Away from home', dgService: 'Start with the PC', dgOn: 'on', dgOff: 'off', dgTurnOn: 'Turn on', dgTurnOff: 'Turn off', dgStream: 'Screen stream', dgStreamVal: 'quality {q} · size {s}% · {fps} frames/s · {kb} KB each', dgVersion: 'Version', dgUptime: 'Running for', dgGood: 'All good', dgOffline: 'Cannot reach the PC', dgOff1: 'Check that the PC is on and signed in to Windows.', dgOff2: 'Away from home, Tailscale must be on on the phone. At home, check the phone is on the same Wi‑Fi as the PC.', dgOff3: 'handremote must be running on the PC. With "Start with the PC" on, it starts by itself after a restart.', adRelay: 'Tailscale could not connect directly and goes through a relay, which can be slow. At home, use the same Wi‑Fi.', adSlowRtt: 'Slow responses: the screen lags and its quality goes down by itself.', adSlowDown: 'Slow download: quality and size go down by themselves.', adPart: 'The "{name}" part on the PC does not answer. Measure again in a moment or restart handremote.', adService: 'handremote does not start by itself when the PC restarts.', adRemote: 'Not reachable away from home: {reason}', dgHandover: 'Handing over to the logon service… reconnecting in a few seconds', devices: 'Devices', devicesTitle: 'Paired devices', dThis: 'this device', dSeen: 'last used', pControl: 'Control', pFiles: 'Files', pTerm: 'Terminal', pAdmin: 'Admin', dLook: 'Viewing is always allowed', dRename: 'Rename', dRemove: 'Unpair', dRemoveAsk: 'Unpair "{name}"? It has to be paired again to be used.', dRemoved: 'Unpaired', dAdd: 'Add a device', dAddTitle: 'Permissions for the new device', dAddHint: 'The invite works once, for 10 minutes.', dMake: 'Make an invite link', dInviteHint: 'Scan the QR code with the new device or send it the link. Valid until {time}.', dCopy: 'Copy link', dCopied: 'Link copied', dRotate: 'Replace the PC link', dRotateAsk: 'QR codes and links handed out so far will no longer pair new devices. Paired devices stay. Replace it?', dRotated: 'The PC link was replaced. Its new QR code is at localhost:9100/connect on the PC.', dLinked: 'Through handide · all permissions', dName: 'Device name', 'err.last-admin': 'At least one device has to keep Admin', 'err.perm-control': 'This device may only view', 'err.perm-files': 'This device has no Files permission', 'err.perm-term': 'This device has no Terminal permission', 'err.perm-admin': 'This device has no Admin permission', fCancel: 'Cancel', fCancelled: 'Upload cancelled', vReconnect: 'Connection lost · reconnecting…', vRetry: 'Reconnect', vLost: 'Cannot reach the PC', termOpen: 'Open terminals', termStart: 'Open a new one', termEnd: 'End this terminal', termCurrent: 'now', term: 'Terminal', termEnded: 'The terminal ended', termNew: 'New terminal', termType: 'Command or text', termRun: 'Run', files: 'Files', filesTitle: 'PC files', fOpen: 'Open on the PC', fGet: 'Save to phone', fShow: 'Show in Explorer', fUp: 'Upload from phone', fUploaded: 'Uploaded', fUploading: 'Uploading…', fEmpty: 'Empty folder', fNoAccess: 'This folder cannot be opened', fMore: 'Too many items: some are shown', fPlaces: 'Places', fDrives: 'Drives', pDesktop: 'Desktop', pDownloads: 'Downloads', pDocuments: 'Documents', pPictures: 'Pictures', pHome: 'Home', dlDone: 'Download finished', dlOpen: 'Open', dlFolder: 'Show in folder', dlLater: 'Close', dlWaiting: 'Opening on the PC…', micOn: 'Microphone on · pick "CABLE Output" as the microphone on the PC', micOff: 'Microphone off', micDenied: 'Microphone access was denied', micGuideTitle: 'The PC needs a virtual microphone driver', micGuide: 'Windows does not let a program add a microphone, so a free virtual audio cable (VB-CABLE) has to be installed on the PC once.', micStep1: 'On the PC, open vb-audio.com/Cable and download the VB-CABLE Driver.', micStep2: 'Unzip it, right-click VBCABLE_Setup_x64.exe → Run as administrator → Install Driver.', micStep3: 'Restart the PC.', micStep4: 'In the call or recording app, pick "CABLE Output" (with Hi-Fi Cable: "Hi-Fi Cable Output") as the microphone.', micCopy: 'Copy address', micCopied: 'Address copied', soundOff: 'Muted', soundWindow: 'This window', soundAll: 'Whole PC', soundFailed: 'Could not get the sound', back: '‹ List', close: 'Close', closeOne: 'Close this window', closeAll: 'Close all {n} {proc} windows', closeHint: 'An app with unsaved work asks on the PC whether to save it.', closed: 'Asked {n} window(s) to close', closeFailed: '{n} window(s) could not be closed',
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
		micOnPick: 'マイクオン · PCの通話・録音アプリでマイクに「{pick}」を選んでください', micInstall: 'PCでセットアップを開く', micInstallHint: 'PCがvb-audio.comから公式パッケージをダウンロードし、作者の署名を確認してからセットアップをそのまま開きます。管理者確認で「はい」を押し（SYSTEMヘルパーがあればスマホからも可）、Install Driverを押してPCを再起動してください。', micManual: '自分でインストールする場合:', 'mic.downloading': '公式サイトからダウンロード中…', 'mic.verifying': '作者の署名を確認中…', 'mic.asking': 'PCで管理者確認を待っています…', 'mic.opened': 'PCでセットアップを開きました。Install Driverを押してPCを再起動してください。', 'mic.ready': 'ダウンロードと署名確認が済みました', 'mic.failed': '開けませんでした: {error}', 'mic.cancelled': '管理者確認がキャンセルされました', modeTouch: 'タッチ: タップ=クリック · ドラッグ=スクロール · ピンチ=拡大', modeDrag: 'ドラッグ: ドラッグで選択・移動', modePointer: 'ポインター: ドラッグでカーソル移動 · タップ=クリック · 長押し=右クリック · 長押し後ドラッグ=ドラッグ', zoomReset: '元のサイズへ', diag: '接続状態', diagRun: '再測定', diagMeasuring: '測定中…', dgPath: '接続経路', dgLan: '同じWi‑Fi（直接）', dgTsDirect: 'Tailscale · 直接接続', dgTsRelay: 'Tailscale · 中継サーバー経由（{relay}）', dgTs: 'Tailscale', dgHandide: 'handide経由', dgLocal: 'このPC', dgRtt: '応答時間', dgDown: '受信速度', dgUp: '送信速度', dgParts: 'PCの構成要素', dgFrames: '画面', dgControl: '操作', dgSound: '音', dgHelper: 'SYSTEMヘルパー', dgHelperNo: '未インストール', dgHelperDown: '応答なし', dgRemote: '外出先からの接続', dgService: 'PC起動時に自動実行', dgOn: 'オン', dgOff: 'オフ', dgTurnOn: 'オンにする', dgTurnOff: 'オフにする', dgStream: '画面転送', dgStreamVal: '画質 {q} · サイズ {s}% · 毎秒 {fps}枚 · 1枚 {kb} KB', dgVersion: 'バージョン', dgUptime: '実行時間', dgGood: '問題なし', dgOffline: 'PCに接続できません', dgOff1: 'PCの電源が入っていて、Windowsにサインインしているか確認してください。', dgOff2: '外出先ではスマホのTailscaleをオンにしてください。自宅ではPCと同じWi‑Fiか確認してください。', dgOff3: 'PCでhandremoteが実行中である必要があります。「PC起動時に自動実行」をオンにすると再起動後も自動で起動します。', adRelay: 'Tailscaleが直接接続できず中継サーバーを経由しています。遅くなることがあります。自宅では同じWi‑Fiで接続してください。', adSlowRtt: '応答が遅いです。画面の追従が遅れ、画質が自動で下がります。', adSlowDown: '受信速度が低いため、画質とサイズが自動で下がります。', adPart: 'PCの「{name}」が応答しません。少し待って再測定するか、handremoteを再起動してください。', adService: 'PCを再起動してもhandremoteは自動で起動しません。', adRemote: '外出先からは接続できません: {reason}', dgHandover: '自動実行に切り替え中… 数秒後に再接続します', devices: 'デバイス', devicesTitle: '接続済みのデバイス', dThis: 'このデバイス', dSeen: '最終使用', pControl: '操作', pFiles: 'ファイル', pTerm: 'ターミナル', pAdmin: '管理', dLook: '表示は常に可能です', dRename: '名前を変更', dRemove: '接続を解除', dRemoveAsk: '「{name}」の接続を解除しますか？再び使うには接続し直す必要があります。', dRemoved: '接続を解除しました', dAdd: 'デバイスを追加', dAddTitle: '新しいデバイスの権限', dAddHint: '招待リンクは10分間、1回だけ使えます。', dMake: '招待リンクを作成', dInviteHint: '新しいデバイスのカメラでQRを読み取るか、リンクを送ってください。{time}まで有効です。', dCopy: 'リンクをコピー', dCopied: 'リンクをコピーしました', dRotate: 'PCのリンクを変更', dRotateAsk: 'これまでに配ったQRコードとリンクでは新しいデバイスを接続できなくなります。接続済みのデバイスはそのままです。変更しますか？', dRotated: 'PCのリンクを変更しました。新しいQRコードはPCで localhost:9100/connect を開くと表示されます。', dLinked: 'handide経由 · すべての権限', dName: 'デバイス名', 'err.last-admin': '管理権限のあるデバイスが1台は必要です', 'err.perm-control': 'このデバイスは表示のみです', 'err.perm-files': 'このデバイスにはファイル権限がありません', 'err.perm-term': 'このデバイスにはターミナル権限がありません', 'err.perm-admin': 'このデバイスには管理権限がありません', fCancel: 'キャンセル', fCancelled: 'アップロードをキャンセルしました', vReconnect: '接続が切れました · 再接続しています…', vRetry: '再接続', vLost: 'PC に接続できません', termOpen: '開いているターミナル', termStart: '新しく開く', termEnd: 'このターミナルを終了', termCurrent: '表示中', term: 'ターミナル', termEnded: 'ターミナルが終了しました', termNew: '新しいターミナル', termType: 'コマンドまたは入力', termRun: '実行', files: 'ファイル', filesTitle: 'PC のファイル', fOpen: 'PC で開く', fGet: 'スマホに保存', fShow: 'エクスプローラーで表示', fUp: 'スマホからアップロード', fUploaded: 'アップロードしました', fUploading: 'アップロード中…', fEmpty: '空のフォルダーです', fNoAccess: 'このフォルダーは開けません', fMore: '項目が多いため一部を表示しています', fPlaces: 'よく使う場所', fDrives: 'ドライブ', pDesktop: 'デスクトップ', pDownloads: 'ダウンロード', pDocuments: 'ドキュメント', pPictures: 'ピクチャ', pHome: 'ユーザー フォルダー', dlDone: 'ダウンロード完了', dlOpen: '開く', dlFolder: 'フォルダーで表示', dlLater: '閉じる', dlWaiting: 'PC で開いています…', micOn: 'マイク オン · PC で「CABLE Output」をマイクに選んでください', micOff: 'マイク オフ', micDenied: 'マイクの許可が拒否されました', micGuideTitle: 'PC に仮想マイクのドライバーが必要です', micGuide: 'Windows ではプログラムがマイクを追加できないため、無料の仮想オーディオケーブル (VB-CABLE) を PC に一度インストールします。', micStep1: 'PC で vb-audio.com/Cable を開き、VB-CABLE Driver をダウンロードします。', micStep2: '展開して VBCABLE_Setup_x64.exe を右クリック → 管理者として実行 → Install Driver。', micStep3: 'PC を再起動します。', micStep4: '通話・録音アプリでマイクを「CABLE Output」(Hi-Fi Cable なら「Hi-Fi Cable Output」)にします。', micCopy: 'アドレスをコピー', micCopied: 'アドレスをコピーしました', soundOff: 'ミュート', soundWindow: 'このウィンドウの音', soundAll: 'PC 全体の音', soundFailed: '音を取得できませんでした', back: '‹ 一覧', close: '閉じる', closeOne: 'このウィンドウを閉じる', closeAll: '{proc} のウィンドウ {n} 個をすべて閉じる', closeHint: '保存していない内容があると、PC で保存するか確認されます。', closed: '{n} 個のウィンドウに閉じる指示を送りました', closeFailed: '{n} 個のウィンドウは閉じられませんでした',
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
		micOnPick: '麦克风已开 · 在 PC 的通话或录音程序中把麦克风选为“{pick}”', micInstall: '在 PC 上打开安装程序', micInstallHint: 'PC 会从 vb-audio.com 下载官方安装包，确认作者签名后原样打开安装程序。在管理员确认中点“是”（有 SYSTEM 助手时也可在手机上操作），在安装窗口点 Install Driver，然后重启 PC。', micManual: '自己安装：', 'mic.downloading': '正在从官网下载…', 'mic.verifying': '正在确认作者签名…', 'mic.asking': '正在等待 PC 上的管理员确认…', 'mic.opened': '已在 PC 上打开安装程序。点 Install Driver 后重启 PC。', 'mic.ready': '已下载并确认签名', 'mic.failed': '无法打开：{error}', 'mic.cancelled': '管理员确认已取消', modeTouch: '触摸：点按=单击 · 拖动=滚动 · 双指张开=放大', modeDrag: '拖拽：拖动以选择或移动', modePointer: '指针：拖动移动光标 · 点按=单击 · 长按=右键 · 长按后拖动=拖拽', zoomReset: '恢复原始大小', diag: '连接状态', diagRun: '重新测量', diagMeasuring: '正在测量…', dgPath: '连接路径', dgLan: '同一 Wi‑Fi（直连）', dgTsDirect: 'Tailscale · 直连', dgTsRelay: 'Tailscale · 经中继服务器（{relay}）', dgTs: 'Tailscale', dgHandide: '经 handide', dgLocal: '本机', dgRtt: '响应时间', dgDown: '下载速度', dgUp: '上传速度', dgParts: 'PC 组件', dgFrames: '画面', dgControl: '操作', dgSound: '声音', dgHelper: 'SYSTEM 助手', dgHelperNo: '未安装', dgHelperDown: '无响应', dgRemote: '外出时访问', dgService: '开机自动运行', dgOn: '开', dgOff: '关', dgTurnOn: '打开', dgTurnOff: '关闭', dgStream: '画面传输', dgStreamVal: '画质 {q} · 尺寸 {s}% · 每秒 {fps} 帧 · 每帧 {kb} KB', dgVersion: '版本', dgUptime: '运行时间', dgGood: '一切正常', dgOffline: '无法连接到 PC', dgOff1: '请确认 PC 已开机并已登录 Windows。', dgOff2: '外出时手机需打开 Tailscale；在家请确认手机与 PC 在同一 Wi‑Fi。', dgOff3: 'PC 上需要运行 handremote。打开“开机自动运行”后，重启后也会自动启动。', adRelay: 'Tailscale 无法直连，正经中继服务器转发，可能较慢。在家请使用同一 Wi‑Fi。', adSlowRtt: '响应较慢：画面跟随变慢，画质会自动降低。', adSlowDown: '下载速度较低：画质和尺寸会自动降低。', adPart: 'PC 的“{name}”部分无响应。请稍后重新测量或重启 handremote。', adService: 'PC 重启后 handremote 不会自动启动。', adRemote: '外出时无法访问：{reason}', dgHandover: '正在切换到开机自动运行… 几秒后重新连接', devices: '设备', devicesTitle: '已连接的设备', dThis: '本设备', dSeen: '最近使用', pControl: '操作', pFiles: '文件', pTerm: '终端', pAdmin: '管理', dLook: '始终可以查看', dRename: '重命名', dRemove: '断开连接', dRemoveAsk: '断开“{name}”的连接？再次使用需要重新连接。', dRemoved: '已断开连接', dAdd: '添加设备', dAddTitle: '新设备的权限', dAddHint: '邀请链接10分钟内只能使用一次。', dMake: '创建邀请链接', dInviteHint: '用新设备的相机扫描二维码或发送链接。有效期至 {time}。', dCopy: '复制链接', dCopied: '已复制链接', dRotate: '更换PC链接', dRotateAsk: '之前分发的二维码和链接将无法再连接新设备。已连接的设备不受影响。要更换吗？', dRotated: '已更换PC链接。在PC上打开 localhost:9100/connect 可看到新的二维码。', dLinked: '通过 handide · 全部权限', dName: '设备名称', 'err.last-admin': '至少要有一台设备保留管理权限', 'err.perm-control': '本设备只能查看', 'err.perm-files': '本设备没有文件权限', 'err.perm-term': '本设备没有终端权限', 'err.perm-admin': '本设备没有管理权限', fCancel: '取消', fCancelled: '已取消上传', vReconnect: '连接已断开 · 正在重新连接…', vRetry: '重新连接', vLost: '无法连接到电脑', termOpen: '已打开的终端', termStart: '新建', termEnd: '结束此终端', termCurrent: '当前', term: '终端', termEnded: '终端已结束', termNew: '新终端', termType: '命令或输入', termRun: '运行', files: '文件', filesTitle: '电脑文件', fOpen: '在电脑上打开', fGet: '保存到手机', fShow: '在资源管理器中显示', fUp: '从手机上传', fUploaded: '已上传', fUploading: '正在上传…', fEmpty: '空文件夹', fNoAccess: '无法打开此文件夹', fMore: '项目太多，仅显示部分', fPlaces: '常用位置', fDrives: '驱动器', pDesktop: '桌面', pDownloads: '下载', pDocuments: '文档', pPictures: '图片', pHome: '用户文件夹', dlDone: '下载完成', dlOpen: '打开', dlFolder: '在文件夹中显示', dlLater: '关闭', dlWaiting: '正在电脑上打开…', micOn: '麦克风已开 · 在电脑上选择 "CABLE Output" 作为麦克风', micOff: '麦克风已关', micDenied: '麦克风权限被拒绝', micGuideTitle: '电脑需要虚拟麦克风驱动', micGuide: 'Windows 不允许程序添加麦克风，需要在电脑上安装一次免费的虚拟音频线 (VB-CABLE)。', micStep1: '在电脑上打开 vb-audio.com/Cable，下载 VB-CABLE Driver。', micStep2: '解压后右键 VBCABLE_Setup_x64.exe → 以管理员身份运行 → Install Driver。', micStep3: '重启电脑。', micStep4: '在通话或录音软件中把麦克风选为 "CABLE Output"（Hi-Fi Cable 则为 "Hi-Fi Cable Output"）。', micCopy: '复制地址', micCopied: '地址已复制', soundOff: '静音', soundWindow: '此窗口声音', soundAll: '全部声音', soundFailed: '无法获取声音', back: '‹ 列表', close: '关闭', closeOne: '关闭此窗口', closeAll: '关闭全部 {n} 个 {proc} 窗口', closeHint: '有未保存内容的应用会在电脑上询问是否保存。', closed: '已让 {n} 个窗口关闭', closeFailed: '{n} 个窗口未能关闭',
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
	if (w.viewOnly || !me.perms.control) return open;
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
	if (!me.perms.control) return toast(t('err.perm-control'), true);
	try {
		const r = await api('api/tray', { item: item.item, button });
		if (r.opened) openViewer({ hwnd: r.opened, title: r.title || item.name.split('\n')[0], fit: false });
		else toast(t('opened'), true);
	} catch (err) {
		toast(err.message, true);
	}
}

function openPort(port) {
	if (!me.perms.control) return toast(t('err.perm-control'), true);
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

function openViewer({ hwnd, title, fit, auto = false, parent = null, again = false }) {
	if (viewer.ws) closeViewer(true);
	$('viewer').hidden = false;
	$('v-title').textContent = title || '';
	$('v-sas').hidden = hwnd !== 0 || !me.perms.control;
	$('v-fit').hidden = hwnd === 0 || !me.perms.control;
	// A phone that may only look: no microphone, keys or typing.
	$('v-mic').hidden = $('keys').hidden = $('typebar').hidden = !me.perms.control;
	if (!again) {
		$('screen').removeAttribute('src'); // a reconnect keeps the last picture meanwhile
		viewer.retries = 0;
		viewerStatus(null);
	}
	Object.assign(viewer, { hwnd, auto, parent, fitted: false, viewOnly: false, mods: new Set() });
	if (!again) {
		Object.assign(cursor, { fx: 0.5, fy: 0.5 });
		resetZoom();
	}
	renderKeys();
	if (sound.mode !== 'off') soundContext(); // opened from a tap: the moment audio may start
	// The phone's back gesture closes the window view instead of leaving the page.
	if (!history.state?.viewer) history.pushState({ viewer: true }, '');
	// The size the window gets: the stage, once the viewer is laid out.
	requestAnimationFrame(() => {
		const size = stageSize();
		const url = new URL(`api/view?hwnd=${hwnd}&fit=${fit ? 1 : 0}&w=${size.w}&h=${size.h}&dpr=${window.devicePixelRatio || 2}&ack=1`, location.href);
		url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const ws = new WebSocket(url);
		ws.binaryType = 'arraybuffer';
		viewer.ws = ws;
		ws.onmessage = (e) => {
			viewer.heard = Date.now();
			if (typeof e.data !== 'string') {
				const bytes = new Uint8Array(e.data);
				if (bytes[0] === 0x41) return playSound(e.data);
				showFrame(new Blob([e.data], { type: 'image/jpeg' }));
				if (viewer.frame?.n) ws.send(JSON.stringify({ t: 'ack', n: viewer.frame.n })); // the PC paces itself on these
				return;
			}
			const m = JSON.parse(e.data);
			if (m.t === 'ready') {
				viewer.retries = 0;
				viewerStatus(null);
				viewer.viewOnly = m.viewOnly;
				viewer.fitted = m.fitted;
				updateFit();
				if (sound.mode !== 'off') ws.send(JSON.stringify({ t: 'sound', mode: sound.mode }));
				if (m.noControl) toast(t('err.perm-control'), true);
				else if (m.viewOnly) toast(t('err.view-only'));
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
			else if (m.t === 'error') toast(errText({ code: m.code, message: m.msg }));
		};
		viewer.heard = Date.now();
		// Dropped (network change, PC restart…): the same window again, not the list.
		ws.onclose = () => viewer.ws === ws && reconnectViewer({ hwnd, title, fit: viewer.fitted || fit, parent: viewer.parent });
	});
	schedule();
}

function showFrame(blob) {
	const img = $('screen');
	const url = URL.createObjectURL(blob);
	const prev = viewer.url;
	viewer.url = url;
	img.onload = () => {
		if (prev) URL.revokeObjectURL(prev);
		const size = `${img.naturalWidth}x${img.naturalHeight}`;
		if (size !== viewer.shown) {
			viewer.shown = size;
			clampZoom();
			applyZoom();
		}
	};
	img.src = url;
}

// ---------------------------------------------------------------- reconnecting
// A dropped window view comes back by itself: tries after 1, 2, 4… seconds (at most 10),
// the last picture stays meanwhile with the state on top, and after about a minute a
// button to try again. A view that hears nothing for 12 s (the PC sends a sign of life
// every 5 s) counts as dropped too.
function viewerStatus(text, retry = false) {
	const box = $('v-status');
	box.hidden = !text;
	box.replaceChildren(...(text ? [h('span', {}, text)] : []), ...(retry ? [h('button', { type: 'button', class: 'chip', onclick: () => viewer.lost && ((viewer.retries = 0), reconnectViewer(viewer.lost)) }, t('vRetry'))] : []));
}

function reconnectViewer(target) {
	viewer.ws = null;
	clearTimeout(viewer.retryTimer);
	if ($('viewer').hidden || document.hidden) return;
	viewer.lost = target;
	viewer.retries = (viewer.retries || 0) + 1;
	if (viewer.retries > 10) return viewerStatus(t('vLost'), true);
	viewerStatus(t('vReconnect'));
	const wait = Math.min(10000, 1000 * 2 ** (viewer.retries - 1));
	viewer.retryTimer = setTimeout(() => {
		if (!$('viewer').hidden && !viewer.ws && !document.hidden) openViewer({ ...target, again: true });
	}, wait);
}

setInterval(() => {
	const ws = viewer.ws;
	if (!ws || ws.readyState !== 1 || document.hidden || Date.now() - (viewer.heard || 0) < 12000) return;
	viewer.ws = null;
	ws.close();
	reconnectViewer({ hwnd: viewer.hwnd, title: $('v-title').textContent, fit: viewer.fitted, parent: viewer.parent });
}, 2000);

/** replacing: another window opens right away; fromHistory: the back gesture already went back. */
function closeViewer(replacing = false, fromHistory = false) {
	viewer.paused = null;
	if (!replacing) {
		clearTimeout(viewer.retryTimer);
		viewer.lost = null;
		viewerStatus(null);
	}
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

// ---------------------------------------------------------------- files
// The PC's folders as a phone list: the usual places and the drives first, then folders
// down from there. A file: open it on the PC (its window is shown), save it to the phone,
// or show it in Explorer. Files from the phone go into the folder shown.
const files = { path: null };
const PLACE = { desktop: 'pDesktop', downloads: 'pDownloads', documents: 'pDocuments', pictures: 'pPictures', home: 'pHome' };
const when = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' }) : '');

function openFiles() {
	$('files').hidden = false;
	if (!history.state?.files) history.pushState({ files: true }, '');
	showFolder(files.path);
}

function closeFiles(fromHistory = false) {
	$('files').hidden = true;
	if (!fromHistory && history.state?.files) history.back();
}
window.addEventListener('popstate', () => !$('files').hidden && $('viewer').hidden && closeFiles(true));

async function showFolder(path) {
	const list = $('files-list');
	// The folder's own name (the whole path does not fit a phone's width).
	$('f-title').textContent = path ? path.split('\\').filter(Boolean).pop() || path : t('filesTitle');
	$('f-title').title = path || '';
	$('f-up').hidden = !path;
	$('f-upload').hidden = !path;
	list.replaceChildren(h('p', { class: 'empty' }, t('loading')));
	let data;
	try {
		data = await api(`api/files${path ? `?path=${encodeURIComponent(path)}` : ''}`);
	} catch (err) {
		list.replaceChildren(h('p', { class: 'empty' }, err.message === 'no access' ? t('fNoAccess') : err.message));
		files.parent = path ? null : undefined;
		return;
	}
	files.path = path || null;
	files.parent = data.parent ?? null;
	list.scrollTop = 0;
	if (!path) {
		list.replaceChildren(
			group(t('fPlaces'), null, data.places.map((p) => row({ icon: '📁', title: t(PLACE[p.key] || 'pHome'), sub: p.path, onTap: () => showFolder(p.path) }))),
			group(t('fDrives'), null, data.drives.map((d) => row({ icon: '💽', title: d.name, sub: d.path, onTap: () => showFolder(d.path) }))),
		);
		return;
	}
	const rows = data.entries.map((e) =>
		row({
			icon: e.dir ? '📁' : fileIcon(e.name),
			title: e.name,
			sub: e.dir ? when(e.mtime) : [e.size != null ? mb(e.size) : null, when(e.mtime)].filter(Boolean).join(' · '),
			onTap: () => (e.dir ? showFolder(joinPath(path, e.name)) : fileActions(joinPath(path, e.name), e)),
		}),
	);
	list.replaceChildren(...(rows.length ? [h('div', { class: 'rows' }, rows)] : [h('p', { class: 'empty' }, t('fEmpty'))]), ...(data.more ? [h('p', { class: 'note' }, t('fMore'))] : []));
}

const joinPath = (dir, name) => (dir.endsWith('\\') ? dir + name : `${dir}\\${name}`);

function fileIcon(name) {
	const ext = (name.split('.').pop() || '').toLowerCase();
	if (/^(png|jpe?g|gif|webp|bmp|heic|svg)$/.test(ext)) return '🖼';
	if (/^(mp4|mov|mkv|avi|webm)$/.test(ext)) return '🎞';
	if (/^(mp3|wav|m4a|flac|ogg)$/.test(ext)) return '🎵';
	if (/^(zip|7z|rar|gz|tar)$/.test(ext)) return '🗜';
	if (/^(exe|msi|bat|cmd|ps1)$/.test(ext)) return '⚙';
	if (/^(pdf)$/.test(ext)) return '📕';
	return '📄';
}

function fileActions(path, e) {
	$('sheet-title').textContent = e.name;
	const act = (label, fn, cls = '') => h('button', { type: 'button', class: `sheet-act ${cls}`, onclick: () => (($('sheet').hidden = true), fn()) }, label);
	$('sheet-body').replaceChildren(
		h('p', { class: 'sheet-hint' }, [e.size != null ? mb(e.size) : null, when(e.mtime)].filter(Boolean).join(' · ')),
		h(
			'div',
			{ class: 'sheet-acts' },
			act(t('fOpen'), () => openOnPc(() => api('api/files/open', { path })).then(() => !$('viewer').hidden && closeFiles()), 'primary'),
			act(t('fGet'), () => {
				const a = h('a', { href: `api/file?path=${encodeURIComponent(path)}`, download: e.name });
				document.body.append(a);
				a.click();
				a.remove();
			}),
			act(t('fShow'), () => openOnPc(() => api('api/files/open', { path, how: 'folder' }))),
		),
	);
	$('sheet').hidden = false;
}

$('f-close').addEventListener('click', () => closeFiles());

// ---------------------------------------------------------------- terminal
// PowerShell on the PC in a real terminal (xterm.js on the phone, a pseudo console on the
// PC). It keeps running when the phone leaves: coming back attaches to it again.
const term = { xterm: null, fit: null, ws: null, id: null, ctrl: false };
try {
	term.id = localStorage.getItem('handremote.term') || null;
} catch {}

function loadScript(src) {
	return new Promise((resolve, reject) => {
		const s = h('script', { src });
		s.onload = resolve;
		s.onerror = reject;
		document.head.append(s);
	});
}

async function openTerm() {
	$('term').hidden = false;
	if (!history.state?.term) history.pushState({ term: true }, '');
	if (!term.xterm) {
		document.head.append(h('link', { rel: 'stylesheet', href: 'vendor/xterm.css' }));
		await loadScript('vendor/xterm.js');
		await loadScript('vendor/addon-fit.js');
		term.xterm = new window.Terminal({ fontSize: 13, cursorBlink: true, scrollback: 5000, theme: { background: '#0b0c0f' }, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' });
		term.fit = new window.FitAddon.FitAddon();
		term.xterm.loadAddon(term.fit);
		term.xterm.open($('term-screen'));
		term.xterm.onData((d) => sendTerm(term.ctrl ? ctrlOf(d) : d));
		new ResizeObserver(() => fitTerm()).observe($('term-screen'));
	}
	fitTerm();
	connectTerm();
}

function fitTerm() {
	if (!term.fit || $('term').hidden) return;
	try {
		term.fit.fit();
	} catch {}
	if (term.ws?.readyState === 1) term.ws.send(JSON.stringify({ t: 'resize', cols: term.xterm.cols, rows: term.xterm.rows }));
}

function connectTerm(shell = null) {
	if (term.ws && term.ws.readyState <= 1) return;
	const pick = term.id ? `&id=${encodeURIComponent(term.id)}` : shell ? `&shell=${encodeURIComponent(shell)}` : '';
	const url = new URL(`api/term?cols=${term.xterm.cols}&rows=${term.xterm.rows}${pick}`, location.href);
	url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const ws = new WebSocket(url);
	ws.binaryType = 'arraybuffer';
	term.ws = ws;
	ws.onmessage = (e) => {
		if (typeof e.data !== 'string') return term.xterm.write(new Uint8Array(e.data));
		const m = JSON.parse(e.data);
		if (m.t === 'ready') {
			term.xterm.reset(); // a resumed terminal is replayed by the PC from its own record
			term.ready = m;
			$('term-shell').textContent = `${m.shell?.name || t('term')} ▾`;
			term.id = m.id;
			try {
				localStorage.setItem('handremote.term', m.id);
			} catch {}
			fitTerm();
		} else if (m.t === 'exit') {
			term.id = null;
			try {
				localStorage.removeItem('handremote.term');
			} catch {}
			term.xterm.write(`\r\n\x1b[90m[${t('termEnded')}]\x1b[0m\r\n`);
		}
	};
	ws.onclose = () => term.ws === ws && (term.ws = null);
}

function sendTerm(s) {
	if (!term.ws || term.ws.readyState !== 1) return connectTerm();
	term.ws.send(new TextEncoder().encode(s));
}

/** Ctrl held from the key bar: the next letter as its control character. */
function ctrlOf(d) {
	term.ctrl = false;
	$('term-keys').querySelector('[data-k="ctrl"]').setAttribute('aria-pressed', 'false');
	const c = d.toUpperCase().charCodeAt(0);
	return d.length === 1 && c >= 64 && c <= 95 ? String.fromCharCode(c - 64) : d;
}

function closeTerm(fromHistory = false) {
	$('term').hidden = true;
	term.ws?.close(); // the terminal itself keeps running on the PC
	term.ws = null;
	if (!fromHistory && history.state?.term) history.back();
}
window.addEventListener('popstate', () => !$('term').hidden && closeTerm(true));

const TERM_KEYS = [
	['Esc', '\x1b'],
	['Tab', '\t'],
	['Ctrl', 'ctrl'],
	['^C', '\x03'],
	['↑', '\x1b[A'],
	['↓', '\x1b[B'],
	['←', '\x1b[D'],
	['→', '\x1b[C'],
	['Home', '\x1b[H'],
	['End', '\x1b[F'],
	['PgUp', '\x1b[5~'],
	['PgDn', '\x1b[6~'],
];
$('term-keys').replaceChildren(
	...TERM_KEYS.map(([label, seq]) =>
		h(
			'button',
			{
				type: 'button',
				'data-k': seq === 'ctrl' ? 'ctrl' : null,
				'aria-pressed': seq === 'ctrl' ? 'false' : null,
				onpointerdown: (e) => e.preventDefault(), // keep the keyboard up
				onclick: (e) => {
					if (seq !== 'ctrl') return sendTerm(seq);
					term.ctrl = !term.ctrl;
					e.currentTarget.setAttribute('aria-pressed', String(term.ctrl));
					term.xterm?.focus();
				},
			},
			label,
		),
	),
);
$('term-form').addEventListener('submit', (e) => {
	e.preventDefault();
	const box = $('term-type');
	sendTerm(`${box.value}\r`);
	box.value = '';
});
// The shell picker: the terminals running on the PC (switch to one), the shells installed
// there (open a new terminal with one), and ending the one shown.
function switchTerm(id, shell = null) {
	term.ws?.close();
	term.ws = null;
	term.id = id;
	try {
		if (id) localStorage.setItem('handremote.term', id);
		else localStorage.removeItem('handremote.term');
	} catch {}
	term.xterm?.reset();
	connectTerm(shell);
}

async function pickShell() {
	let data;
	try {
		data = await api('api/term/list');
	} catch (err) {
		return toast(err.message, true);
	}
	const close = () => ($('sheet').hidden = true);
	$('sheet-title').textContent = t('term');
	const running = data.running.map((r) =>
		row({
			icon: r.id === term.id ? '▶' : '›',
			title: r.name,
			sub: [r.id === term.id ? t('termCurrent') : null, new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · '),
			onTap: () => (close(), r.id !== term.id && switchTerm(r.id)),
		}),
	);
	const shells = data.shells.map((s) => row({ icon: '+', title: s.name, sub: s.version || '', onTap: () => (close(), switchTerm(null, s.id)) }));
	$('sheet-body').replaceChildren(
		...(running.length ? [h('p', { class: 'sheet-hint' }, t('termOpen')), h('div', { class: 'rows' }, running)] : []),
		h('p', { class: 'sheet-hint' }, t('termStart')),
		h('div', { class: 'rows' }, shells),
		...(term.id
			? [
					h('div', { class: 'sheet-acts' },
						h('button', {
							type: 'button',
							class: 'sheet-act danger',
							onclick: () => {
								close();
								term.ws?.send(JSON.stringify({ t: 'kill' }));
								switchTerm(null);
							},
						}, t('termEnd')),
					),
				]
			: []),
	);
	$('sheet').hidden = false;
}
$('term-shell').addEventListener('click', pickShell);
$('t-close').addEventListener('click', () => closeTerm());
$('term-type').placeholder = t('termType');
$('open-term').addEventListener('click', openTerm);
document.addEventListener('visibilitychange', () => !document.hidden && !$('term').hidden && connectTerm());
$('f-up').addEventListener('click', () => (files.parent ? showFolder(files.parent) : showFolder(null)));
$('open-files').addEventListener('click', openFiles);
$('f-upload').addEventListener('click', () => $('f-pick').click());
$('f-pick').addEventListener('change', async () => {
	const picked = [...$('f-pick').files];
	$('f-pick').value = '';
	const dir = files.path;
	if (!dir || !picked.length) return;
	for (let i = 0; i < picked.length; i++) {
		const r = await uploadOne(dir, picked[i], picked.length > 1 ? `${i + 1}/${picked.length}` : '');
		if (r === 'cancel') return toast(t('fCancelled'), true);
		if (r !== 'ok') return toast(r || t('offline'), true);
	}
	toast(t('fUploaded'), true);
	if (files.path === dir) showFolder(dir);
});

// One file up, with its progress and a cancel button on the files screen. Resolves 'ok',
// 'cancel' or an error. The PC removes what a cancelled upload left.
function uploadOne(dir, file, count) {
	return new Promise((resolve) => {
		const xhr = new XMLHttpRequest();
		const bar = h('div', { class: 'up-bar' }, h('i'));
		const label = h('span', { class: 'up-name' }, `${count ? `${count} · ` : ''}${file.name}`);
		const pct = h('small', {}, '0%');
		const box = h('div', { class: 'up-box' }, h('div', { class: 'up-row' }, label, pct, h('button', { type: 'button', class: 'chip', onclick: () => xhr.abort() }, t('fCancel'))), bar);
		$('files').append(box);
		const done = (r) => (box.remove(), resolve(r));
		xhr.upload.onprogress = (e) => {
			if (!e.lengthComputable) return;
			const p = Math.round((e.loaded / e.total) * 100);
			pct.textContent = `${p}% · ${mb(e.loaded)} / ${mb(e.total)}`;
			bar.firstChild.style.width = `${p}%`;
		};
		xhr.onload = () => {
			let json = null;
			try {
				json = JSON.parse(xhr.responseText);
			} catch {}
			done(json?.ok ? 'ok' : json?.error || `HTTP ${xhr.status}`);
		};
		xhr.onerror = () => done(t('offline'));
		xhr.onabort = () => done('cancel');
		xhr.open('POST', `api/files/upload?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(file.name)}`);
		xhr.send(file);
	});
}

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
	return openOnPc(() => api('api/download/open', { id: d.id, how }));
}

/** Asks the PC to open something, then shows the window it opened. */
async function openOnPc(ask) {
	const before = new Set((last?.windows || []).map((w) => w.hwnd));
	toast(t('dlWaiting'), true);
	try {
		await ask();
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
	if (m.on) toast(m.pick ? t('micOnPick').replace('{pick}', m.pick) : t('micOn'));
}

function showMicGuide() {
	$('sheet-title').textContent = t('micGuideTitle');
	const url = 'https://vb-audio.com/Cable/';
	// An admin phone can have the PC fetch the official package and open its setup.
	const mayInstall = me.perms.admin && me.perms.control;
	const install = mayInstall
		? [
				h('div', { class: 'sheet-acts' }, h('button', { type: 'button', class: 'sheet-act', id: 'mic-install', onclick: () => installCable() }, t('micInstall'))),
				h('p', { class: 'sheet-hint', id: 'mic-install-state' }, t('micInstallHint')),
				h('p', { class: 'sheet-hint' }, t('micManual')),
			]
		: [];
	$('sheet-body').replaceChildren(
		h('p', { class: 'sheet-hint' }, t('micGuide')),
		...install,
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

/** Has the PC fetch VB-CABLE and open its setup (server/cable.mjs), showing each step. */
async function installCable(dry = false) {
	const show = (s) => {
		const el = $('mic-install-state');
		if (!el) return;
		const key = s.phase === 'failed' && s.error === 'cancelled' ? 'mic.cancelled' : `mic.${s.phase}`;
		el.textContent = (S[key] || STRINGS.en[key]) ? t(key).replace('{error}', s.error || '') : '';
		el.dataset.phase = s.phase;
	};
	$('mic-install').disabled = true;
	try {
		let s = await api('api/mic/install', { dry });
		show(s);
		while (!['opened', 'ready', 'failed', 'idle'].includes(s.phase)) {
			await new Promise((r) => setTimeout(r, 800));
			s = await api('api/mic/install');
			show(s);
		}
	} catch (err) {
		toast(errText(err), true);
	}
	if ($('mic-install')) $('mic-install').disabled = false;
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
	let swiped = 0; // a swipe that closed the drawer is not also a tap on the row under it
	const drawer = $('drawer');
	drawer.addEventListener('pointerdown', (e) => (from = { x: e.clientX, y: e.clientY }));
	drawer.addEventListener('pointermove', (e) => {
		if (!from) return;
		const dx = e.clientX - from.x;
		if (dx > 50 && dx > Math.abs(e.clientY - from.y)) ((from = null), (swiped = Date.now()), closeDrawer());
	});
	drawer.addEventListener(
		'click',
		(e) => {
			if (Date.now() - swiped < 600) (e.stopPropagation(), e.preventDefault());
		},
		true,
	);
	const end = () => (from = null);
	drawer.addEventListener('pointerup', end);
	drawer.addEventListener('pointercancel', end);
}
function updateFit() {
	$('v-fit').textContent = viewer.fitted ? t('fitOrig') : t('fitPhone');
	$('v-fit').hidden = viewer.hwnd === 0 || viewer.viewOnly;
}
$('v-fit').addEventListener('click', () => send(viewer.fitted ? { t: 'nofit' } : { t: 'fit', ...stageSize() }));
$('v-sas').addEventListener('click', () => send({ t: 'sas' }));

const INPUT = new Set(['mouse', 'text', 'key', 'sas', 'mic']);
let deniedAt = 0;
function send(msg) {
	if (!me.perms.control && INPUT.has(msg.t)) {
		if (Date.now() - deniedAt > 3000) toast(t('err.perm-control'), true);
		deniedAt = Date.now();
		return;
	}
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
const avg = (k) => [...pointers.values()].reduce((s, p) => s + p[k], 0) / pointers.size;
const spread = () => {
	const [a, b] = [...pointers.values()];
	return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};
const stagePoint = (x, y) => {
	const r = stage.getBoundingClientRect();
	return [x - r.left, y - r.top];
};

// ---- zoom: the picture on the phone only (the PC window keeps its size). Two fingers
// spread or pinch it; zoomed in, one finger pans it; the "2.0× ✕" chip goes back to 100%.
const zoom = { s: 1, x: 0, y: 0 };

function applyZoom() {
	const img = $('screen');
	img.style.transformOrigin = '0 0';
	img.style.transform = zoom.s === 1 ? '' : `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`;
	$('v-zoom').hidden = zoom.s === 1;
	$('v-zoom').textContent = `${zoom.s.toFixed(1)}× ✕`;
	drawCursor();
}

/** Keeps the zoomed picture over the stage (centred where it is smaller). */
function clampZoom() {
	const img = $('screen');
	zoom.s = Math.min(6, Math.max(1, zoom.s));
	if (zoom.s < 1.03) return Object.assign(zoom, { s: 1, x: 0, y: 0 });
	const fit = (pos, offset, len, room) => {
		const size = len * zoom.s;
		if (size <= room) return (room - size) / 2 - offset;
		return Math.min(-offset, Math.max(room - offset - size, pos));
	};
	zoom.x = fit(zoom.x, img.offsetLeft, img.offsetWidth, stage.clientWidth);
	zoom.y = fit(zoom.y, img.offsetTop, img.offsetHeight, stage.clientHeight);
}

function resetZoom() {
	Object.assign(zoom, { s: 1, x: 0, y: 0 });
	applyZoom();
}

/** The picture's own point (unzoomed px) under a stage point. */
function pictureAt(mx, my) {
	const img = $('screen');
	return [(mx - img.offsetLeft - zoom.x) / zoom.s, (my - img.offsetTop - zoom.y) / zoom.s];
}

function zoomTo(s, mx, my, lx, ly) {
	const img = $('screen');
	zoom.s = Math.min(6, Math.max(1, s));
	zoom.x = mx - img.offsetLeft - lx * zoom.s;
	zoom.y = my - img.offsetTop - ly * zoom.s;
	clampZoom();
	applyZoom();
}

function panBy(dx, dy) {
	zoom.x += dx;
	zoom.y += dy;
	clampZoom();
	applyZoom();
}
$('v-zoom').addEventListener('click', resetZoom);

// ---- input modes: touch (a tap clicks where it lands), drag (a finger holds the button),
// pointer (a touchpad: the finger moves a cursor, slow moves are finer).
const MODES = ['touch', 'drag', 'pointer'];
const MODE_FACE = { touch: ['☝', 'modeTouch'], drag: ['✥', 'modeDrag'], pointer: ['🖱', 'modePointer'] };
const cursor = { fx: 0.5, fy: 0.5, sent: 0 };
try {
	viewer.mode = MODES.includes(localStorage.getItem('handremote.mode')) ? localStorage.getItem('handremote.mode') : 'touch';
} catch {
	viewer.mode = 'touch';
}

function renderMode() {
	const [icon, key] = MODE_FACE[viewer.mode];
	const b = $('v-drag');
	b.textContent = icon;
	b.dataset.mode = viewer.mode;
	b.setAttribute('aria-pressed', String(viewer.mode !== 'touch'));
	b.title = b.ariaLabel = t(key);
	viewer.drag = viewer.mode === 'drag';
	drawCursor();
}
$('v-drag').addEventListener('click', () => {
	viewer.mode = MODES[(MODES.indexOf(viewer.mode) + 1) % MODES.length];
	try {
		localStorage.setItem('handremote.mode', viewer.mode);
	} catch {}
	renderMode();
	toast(t(MODE_FACE[viewer.mode][1]));
});

function drawCursor() {
	const el = $('cursor');
	const img = $('screen');
	// An <svg>: no .hidden property, the attribute itself.
	if (viewer.mode !== 'pointer' || !img.getAttribute('src')) return el.setAttribute('hidden', '');
	const r = img.getBoundingClientRect();
	const [x, y] = stagePoint(r.left + cursor.fx * r.width, r.top + cursor.fy * r.height);
	el.removeAttribute('hidden');
	el.style.transform = `translate(${x}px, ${y}px)`;
}

/** Zoomed in, the picture follows the cursor near the stage's edges. */
function keepCursorInView() {
	if (zoom.s === 1) return;
	const r = $('screen').getBoundingClientRect();
	const [x, y] = stagePoint(r.left + cursor.fx * r.width, r.top + cursor.fy * r.height);
	const m = 32;
	const dx = x < m ? m - x : x > stage.clientWidth - m ? stage.clientWidth - m - x : 0;
	const dy = y < m ? m - y : y > stage.clientHeight - m ? stage.clientHeight - m - y : 0;
	if (dx || dy) panBy(dx, dy);
}

function moveCursor(dx, dy, dt) {
	const r = $('screen').getBoundingClientRect();
	// Slow is precise, fast covers the screen (finger px per ms).
	const v = Math.hypot(dx, dy) / Math.max(dt, 1);
	const gain = v < 0.25 ? 0.45 : v < 0.8 ? 1 : 1.8;
	cursor.fx = Math.min(1, Math.max(0, cursor.fx + (dx * gain) / r.width));
	cursor.fy = Math.min(1, Math.max(0, cursor.fy + (dy * gain) / r.height));
	keepCursorInView();
	drawCursor();
	const now = Date.now();
	if (now - cursor.sent > 30) {
		cursor.sent = now;
		send({ t: 'mouse', a: 'move', fx: cursor.fx, fy: cursor.fy });
	}
}
const atCursor = () => ({ fx: cursor.fx, fy: cursor.fy });

stage.addEventListener('pointerdown', (e) => {
	if (!$('screen').getAttribute('src') || e.target.closest('#v-zoom')) return;
	try {
		stage.setPointerCapture(e.pointerId);
	} catch {} // a pointer the browser no longer tracks
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	if (pointers.size > 2) return;
	if (pointers.size === 2) {
		// Two fingers: spread or pinch zooms the picture, moving together scrolls the PC window.
		clearTimeout(gesture?.timer);
		if (gesture?.kind === 'drag' || gesture?.kind === 'pdrag') send({ t: 'mouse', a: 'up', ...(gesture.kind === 'pdrag' ? atCursor() : gesture.last || gesture.start) });
		const [mx, my] = stagePoint(avg('x'), avg('y'));
		const [lx, ly] = pictureAt(mx, my);
		gesture = { kind: 'two', x: avg('x'), y: avg('y'), mx0: avg('x'), my0: avg('y'), d0: spread(), s0: zoom.s, lx, ly, acc: [0, 0] };
		return;
	}
	const p = at(e);
	// From the right edge: a swipe to the left opens the window drawer (a tap there still clicks).
	const edge = e.clientX > stage.getBoundingClientRect().right - EDGE;
	const pointer = viewer.mode === 'pointer';
	gesture = { kind: 'pending', x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, t: Date.now(), edge, start: p, acc: [0, 0], pointer };
	gesture.timer = setTimeout(() => {
		if (gesture?.kind !== 'pending') return;
		gesture.kind = 'held';
		navigator.vibrate?.(15);
		// Touch: a right click right away. Pointer: on release, or a drag if the finger moves.
		if (!pointer && p.inside) send({ t: 'mouse', a: 'right', ...p });
	}, pointer ? 450 : 550);
});

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
	const dx = x - gesture.x;
	const dy = y - gesture.y;
	const now = Date.now();
	const dt = now - (gesture.mt || gesture.t || now);
	gesture.mt = now;
	if (gesture.kind === 'edge') {
		if (gesture.ox - x > 40) ((gesture.kind = 'done'), openDrawer());
		return;
	}
	if (gesture.kind === 'done') return;
	if (gesture.kind === 'two') {
		if (pointers.size < 2) return;
		const d = spread();
		if (Math.abs(d - gesture.d0) > 24) gesture.kind = 'pinch';
		else if (Math.hypot(x - gesture.mx0, y - gesture.my0) > 16) {
			gesture.kind = 'scroll';
			Object.assign(gesture, at({ clientX: x, clientY: y }));
		}
	}
	if (gesture.kind === 'pinch') {
		if (pointers.size < 2) return;
		const [mx, my] = stagePoint(x, y);
		zoomTo((gesture.s0 * spread()) / gesture.d0, mx, my, gesture.lx, gesture.ly);
	} else if (gesture.kind === 'pending' && Math.hypot(x - gesture.ox, y - gesture.oy) > (gesture.pointer ? 6 : 10)) {
		clearTimeout(gesture.timer);
		if (gesture.edge && pointers.size === 1 && gesture.ox - x > Math.abs(y - gesture.oy)) {
			gesture.kind = 'edge';
			return;
		}
		if (gesture.pointer) gesture.kind = 'aim';
		else if (viewer.drag) {
			gesture.kind = 'drag';
			send({ t: 'mouse', a: 'down', ...gesture.start });
		} else if (zoom.s > 1) gesture.kind = 'pan';
		else {
			gesture.kind = 'scroll';
			Object.assign(gesture, { fx: gesture.start.fx, fy: gesture.start.fy });
		}
	} else if (gesture.kind === 'held' && gesture.pointer && Math.hypot(x - gesture.ox, y - gesture.oy) > 6) {
		gesture.kind = 'pdrag';
		send({ t: 'mouse', a: 'down', ...atCursor() });
	}
	if (gesture.kind === 'scroll') {
		gesture.acc[0] += dx;
		gesture.acc[1] += dy;
		if (gesture.fx == null) Object.assign(gesture, at({ clientX: x, clientY: y }));
		if (!wheelTimer) wheelTimer = setTimeout(flushWheel, 50);
	} else if (gesture.kind === 'pan') panBy(dx, dy);
	else if (gesture.kind === 'aim' || gesture.kind === 'pdrag') moveCursor(dx, dy, dt);
	else if (gesture.kind === 'drag') {
		if (!gesture.sent || now - gesture.sent > 30) {
			gesture.sent = now;
			gesture.last = at(e);
			send({ t: 'mouse', a: 'move', ...gesture.last });
		}
	}
	gesture.x = x;
	gesture.y = y;
});

function endPointer(e) {
	if (!pointers.has(e.pointerId)) return;
	pointers.delete(e.pointerId);
	if (!gesture) return;
	if (pointers.size) {
		// One of two fingers lifted: the other goes on from where it is, without a jump.
		gesture.x = avg('x');
		gesture.y = avg('y');
		return;
	}
	clearTimeout(gesture.timer);
	const up = e.type === 'pointerup';
	if (gesture.kind === 'pending' && up) {
		if (gesture.pointer) send({ t: 'mouse', a: 'click', ...atCursor() });
		else if (gesture.start.inside) send({ t: 'mouse', a: 'click', ...gesture.start });
	} else if (gesture.kind === 'held' && gesture.pointer && up) send({ t: 'mouse', a: 'right', ...atCursor() });
	else if (gesture.kind === 'drag') send({ t: 'mouse', a: 'up', ...at(e) });
	else if (gesture.kind === 'pdrag') send({ t: 'mouse', a: 'up', ...atCursor() });
	else if (gesture.kind === 'scroll') flushWheel();
	else if (gesture.kind === 'aim') send({ t: 'mouse', a: 'move', ...atCursor() });
	gesture = null;
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

// Orientation changes: lay the window out again for the new stage.
let lastStage = null;
window.addEventListener('resize', () => {
	clampZoom();
	applyZoom();
	if (!viewer.ws || !viewer.fitted) return;
	const s = stageSize();
	// The keyboard opening shrinks the stage: only a turn of the phone (width) relays it out.
	if (lastStage && Math.abs(s.w - lastStage.w) > 40) send({ t: 'fit', ...s });
	lastStage = s;
});

// ---------------------------------------------------------------- permissions and devices
// What this phone may do (api/me): buttons for the rest are not shown. A phone with "admin"
// manages the paired devices: their permissions, unpairing, invites for new ones.
const me = { perms: { control: true, files: true, term: true, admin: false }, device: null, linked };

function errText(err) {
	const key = `err.${err.code}`;
	return err.code && (S[key] || STRINGS.en[key]) ? t(key) : err.message;
}

async function loadMe() {
	try {
		Object.assign(me, await api('api/me'));
	} catch {}
	$('open-files').hidden = !me.perms.files;
	$('open-term').hidden = !me.perms.term;
	$('open-devices').hidden = !me.perms.admin;
}

const PERM_LABEL = { control: 'pControl', files: 'pFiles', term: 'pTerm', admin: 'pAdmin' };
const ago = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

function openDevices() {
	$('devices').hidden = false;
	if (!history.state?.devices) history.pushState({ devices: true }, '');
	showDevices();
}

function closeDevices(fromHistory = false) {
	$('devices').hidden = true;
	if (!fromHistory && history.state?.devices) history.back();
}
window.addEventListener('popstate', () => !$('devices').hidden && closeDevices(true));

async function showDevices() {
	const list = $('devices-list');
	let data;
	try {
		data = await api('api/devices');
	} catch (err) {
		return list.replaceChildren(h('p', { class: 'empty' }, errText(err)));
	}
	const card = (d) => {
		const mine = d.id === data.me;
		const perm = (k) =>
			h(
				'button',
				{
					type: 'button',
					class: `perm${d.perms[k] ? ' on' : ''}`,
					'aria-pressed': String(!!d.perms[k]),
					'data-perm': k,
					onclick: () => changeDevice(d.id, { perms: { [k]: !d.perms[k] } }),
				},
				t(PERM_LABEL[k]),
			);
		return h(
			'div',
			{ class: 'device', 'data-id': d.id },
			h('div', { class: 'device-head' }, h('b', {}, d.name), mine ? badge(t('dThis'), 'live') : null),
			h('small', {}, `${t('dSeen')} ${ago(d.seen)}`),
			h('div', { class: 'perms' }, data.perms.map(perm)),
			h(
				'div',
				{ class: 'device-acts' },
				h('button', { type: 'button', class: 'chip', onclick: () => renameDevice(d) }, t('dRename')),
				h('button', { type: 'button', class: 'chip danger', 'data-act': 'remove', onclick: () => removeDevice(d) }, t('dRemove')),
			),
		);
	};
	list.replaceChildren(
		...[me.linked ? h('p', { class: 'note' }, t('dLinked')) : null].filter(Boolean),
		h('p', { class: 'note' }, t('dLook')),
		...data.devices.map(card),
		h(
			'div',
			{ class: 'device-foot' },
			h('button', { type: 'button', class: 'chip', id: 'd-add', onclick: askInvite }, `＋ ${t('dAdd')}`),
			h('button', { type: 'button', class: 'chip danger', id: 'd-rotate', onclick: rotateLink }, t('dRotate')),
		),
	);
}

async function changeDevice(id, change) {
	try {
		await api('api/devices/update', { id, ...change });
	} catch (err) {
		toast(errText(err), true);
	}
	showDevices();
	loadMe();
}

function renameDevice(d) {
	const name = prompt(t('dName'), d.name);
	if (name && name.trim() && name !== d.name) changeDevice(d.id, { name });
}

async function removeDevice(d) {
	if (!confirm(t('dRemoveAsk').replace('{name}', d.name))) return;
	try {
		await api('api/devices/remove', { id: d.id });
		toast(t('dRemoved'), true);
	} catch (err) {
		toast(errText(err), true);
	}
	showDevices();
}

// A new device: pick what it may do, then a one-time link and its QR code.
function askInvite() {
	const picked = { control: true, files: false, term: false, admin: false };
	$('sheet-title').textContent = t('dAddTitle');
	const perm = (k) => {
		const b = h('button', { type: 'button', class: `perm${picked[k] ? ' on' : ''}`, 'data-perm': k, 'aria-pressed': String(picked[k]) }, t(PERM_LABEL[k]));
		b.onclick = () => {
			picked[k] = !picked[k];
			b.classList.toggle('on', picked[k]);
			b.setAttribute('aria-pressed', String(picked[k]));
		};
		return b;
	};
	$('sheet-body').replaceChildren(
		h('div', { class: 'perms' }, Object.keys(PERM_LABEL).map(perm)),
		h('p', { class: 'sheet-hint' }, `${t('dLook')}. ${t('dAddHint')}`),
		h('div', { class: 'sheet-acts' }, h('button', { type: 'button', class: 'sheet-act', id: 'd-make', onclick: () => makeInvite(picked) }, t('dMake'))),
	);
	$('sheet').hidden = false;
}

async function makeInvite(perms) {
	let inv;
	try {
		inv = await api('api/devices/invite', { perms });
	} catch (err) {
		return toast(errText(err), true);
	}
	const time = new Date(inv.expires).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	const copy = h('button', { type: 'button', class: 'sheet-act', onclick: () => navigator.clipboard?.writeText(inv.url).then(() => toast(t('dCopied'), true)) }, t('dCopy'));
	$('sheet-body').replaceChildren(
		h('div', { class: 'invite-qr', html: inv.qr }),
		h('p', { class: 'invite-url', id: 'd-invite-url' }, inv.url),
		h('p', { class: 'sheet-hint' }, t('dInviteHint').replace('{time}', time)),
		h('div', { class: 'sheet-acts' }, copy),
	);
}

async function rotateLink() {
	if (!confirm(t('dRotateAsk'))) return;
	try {
		await api('api/devices/rotate', {});
		toast(t('dRotated'));
	} catch (err) {
		toast(errText(err), true);
	}
}

$('open-devices').addEventListener('click', openDevices);
$('d-close').addEventListener('click', () => closeDevices());

// ---------------------------------------------------------------- connection diagnosis
// Tapping the PC's name: how this phone reaches the PC (same Wi-Fi, Tailscale direct or
// relayed), the response time and speeds measured now, whether each part on the PC
// answers, and whether handremote starts with the PC (an admin phone can turn that on).
function openDiag() {
	$('diag').hidden = false;
	if (!history.state?.diag) history.pushState({ diag: true }, '');
	runDiag();
}
function closeDiag(fromHistory = false) {
	$('diag').hidden = true;
	if (!fromHistory && history.state?.diag) history.back();
}
window.addEventListener('popstate', () => !$('diag').hidden && closeDiag(true));

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const fill = (s, vals) => s.replace(/\{(\w+)\}/g, (_, k) => String(vals[k] ?? ''));
const dur = (ms) => {
	const m = Math.floor(ms / 60000);
	return m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

async function measure() {
	const rtts = [];
	for (let i = 0; i < 5; i++) {
		const t0 = performance.now();
		await fetch('api/ping', { cache: 'no-store' });
		rtts.push(performance.now() - t0);
	}
	let t0 = performance.now();
	const down = (await (await fetch('api/diag/speed?kb=1024', { cache: 'no-store' })).arrayBuffer()).byteLength;
	const downMbps = (down * 8) / ((performance.now() - t0) * 1000);
	t0 = performance.now();
	const up = await fetch('api/diag/speed', { method: 'POST', body: new Uint8Array(512 << 10) }).then((r) => r.json());
	const upMbps = (up.bytes * 8) / ((performance.now() - t0) * 1000);
	return { rtt: Math.round(median(rtts)), down: downMbps, up: upMbps };
}

let diagBusy = false;
async function runDiag() {
	if (diagBusy) return;
	diagBusy = true;
	const list = $('diag-list');
	list.replaceChildren(h('p', { class: 'empty' }, t('diagMeasuring')));
	try {
		let d;
		let m;
		try {
			d = await api('api/diag');
			m = await measure();
		} catch {
			return list.replaceChildren(
				h('div', { class: 'advice bad' }, h('b', {}, t('dgOffline'))),
				h('ol', { class: 'sheet-steps' }, h('li', {}, t('dgOff1')), h('li', {}, t('dgOff2')), h('li', {}, t('dgOff3'))),
				h('div', { class: 'device-foot' }, h('button', { type: 'button', class: 'chip', onclick: runDiag }, t('diagRun'))),
			);
		}
		renderDiag(d, m);
	} finally {
		diagBusy = false;
	}
}

function renderDiag(d, m) {
	const advice = [];
	const p = d.path || {};
	let path = t('dgLocal');
	let pathCls = 'ok';
	if (p.kind === 'lan') path = t('dgLan');
	else if (p.kind === 'handide') path = t('dgHandide');
	else if (p.kind === 'tailscale') {
		if (p.peer && !p.peer.direct) {
			path = fill(t('dgTsRelay'), { relay: p.peer.relay || 'DERP' });
			pathCls = 'warn';
			advice.push(['warn', t('adRelay')]);
		} else path = p.peer ? t('dgTsDirect') : t('dgTs');
	}
	const rttCls = m.rtt > 250 ? 'bad' : m.rtt > 120 ? 'warn' : 'ok';
	if (rttCls !== 'ok') advice.push([rttCls, t('adSlowRtt')]);
	const downCls = m.down < 2 ? 'bad' : m.down < 6 ? 'warn' : 'ok';
	if (downCls !== 'ok') advice.push([downCls, t('adSlowDown')]);
	const PART = { frames: 'dgFrames', control: 'dgControl', sound: 'dgSound' };
	for (const a of d.agents) if (!a.ok) advice.push(['bad', fill(t('adPart'), { name: t(PART[a.name]) })]);
	if (d.service?.supported && !d.service.installed) advice.push(['warn', t('adService')]);
	if (d.remote?.reason && p.kind !== 'handide') advice.push(['info', fill(t('adRemote'), { reason: d.remote.reason })]);

	const mbps = (x) => `${x >= 10 ? Math.round(x) : x.toFixed(1)} Mbps`;
	const line = (label, value, cls = '') => h('div', { class: 'diag-row' }, h('span', {}, label), h('b', { class: cls }, value));
	const helper = d.helper || {};
	const helperText = !helper.installed ? t('dgHelperNo') : helper.connected ? t('dgOn') : helper.allowed === false ? t('dgOff') : t('dgHelperDown');
	const service = d.service || {};
	const serviceBtn =
		service.supported && me.perms.admin
			? h('button', { type: 'button', class: 'chip', id: 'dg-service', onclick: () => setService(!service.installed) }, service.installed ? t('dgTurnOff') : t('dgTurnOn'))
			: null;
	const streams = d.streams.map((s) => line(t('dgStream'), fill(t('dgStreamVal'), { q: s.q, s: Math.round(s.scale * 100), fps: s.fps, kb: s.kb }), s.inflight >= 2 ? 'warn' : ''));

	$('diag-list').replaceChildren(
		...(advice.length ? advice : [['ok', t('dgGood')]]).map(([cls, text]) => h('div', { class: `advice ${cls}` }, text)),
		h(
			'section',
			{ class: 'diag-box' },
			line(t('dgPath'), path, pathCls),
			line(t('dgRtt'), `${m.rtt} ms`, rttCls),
			line(t('dgDown'), mbps(m.down), downCls),
			line(t('dgUp'), mbps(m.up)),
			...streams,
		),
		h(
			'section',
			{ class: 'diag-box' },
			h('h2', {}, t('dgParts')),
			...d.agents.map((a) => line(t(PART[a.name]), a.ok ? `${a.ms} ms` : a.error, a.ok ? 'ok' : 'bad')),
			line(t('dgHelper'), helperText),
		),
		h(
			'section',
			{ class: 'diag-box' },
			line(t('dgRemote'), d.remote?.url ? d.remote.url.replace(/^https:\/\//, '') : d.remote?.reason || '', d.remote?.url ? 'ok' : ''),
			service.supported ? h('div', { class: 'diag-row' }, h('span', {}, t('dgService')), h('b', { class: service.installed ? 'ok' : 'warn' }, service.installed ? t('dgOn') : t('dgOff')), serviceBtn) : null,
			line(t('dgVersion'), `${d.version} · ${d.host}`),
			line(t('dgUptime'), dur(d.uptime)),
		),
		h('div', { class: 'device-foot' }, h('button', { type: 'button', class: 'chip', id: 'dg-run', onclick: runDiag }, t('diagRun'))),
	);
}

async function setService(on) {
	try {
		const r = await api('api/service', { on });
		if (r.handover) {
			toast(t('dgHandover'));
			return setTimeout(runDiag, 9000);
		}
	} catch (err) {
		toast(errText(err), true);
	}
	runDiag();
}

$('open-diag').addEventListener('click', openDiag);
$('dg-close').addEventListener('click', () => closeDiag());

renderMode();
loadMe().then(refresh).then(schedule);
