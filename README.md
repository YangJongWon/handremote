<div align="center">

# handremote

**Your PC's windows, at your phone's size.**

See the open windows, widgets, tray icons and servers by category; tap one and that window is laid out again at the phone's screen size. Not a shrunken desktop: the app redraws itself for the phone, so text stays readable, and you tap and type in it directly.

**English** · [한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

</div>

## Why not remote desktop

VNC, Chrome Remote Desktop and RustDesk copy the PC's monitor. A 1920×1080 landscape screen lands on a portrait phone at a third of its size: you zoom and aim at tiny buttons. handremote goes the other way.

| | Remote desktop | handremote |
|---|---|---|
| Unit | the whole desktop | one window |
| Size | the PC screen, shrunk | the window, laid out at the phone's size (and back when you close it) |
| Status | pixels only | tray, listening ports and server processes as lists |
| Input | touches as mouse coordinates | tap = click, hold = right-click, drag = scroll, an input box for any script |

## Quick start (Windows 10/11)

```sh
npm install -g github:YangJongWon/handremote
handremote
```

Scan the QR code in the terminal with the phone's camera (same Wi-Fi). **http://localhost:9100/connect** on the PC shows it large. Accept the certificate warning once (handremote makes its own HTTPS certificate for the PC).

With [Tailscale](https://tailscale.com) signed in on the PC, it also prints `https://<pc>.<tailnet>.ts.net:9443`, which works away from home for **your own tailnet devices only**. Public links (Funnel) are deliberately not offered.

## On the phone

| Group | What | Tap |
|---|---|---|
| Windows | windows on the taskbar, with process, CPU, memory | open at the phone's size |
| Widgets | always-on-top and tool windows | open (windows that cannot be resized are fitted to the screen) |
| Tray | notification area icons, hidden ones too | clicks it on the PC and shows the menu or window it opened; hold for right-click |
| Web apps | localhost ports that serve a page | open the app on the phone |
| Servers | processes listening on ports | path, command line, start time |
| Secure screen | with the SYSTEM helper: a UAC prompt or the lock screen | opens by itself |

In a window: **tap** click, **hold** right-click, **drag with one or two fingers** scroll, **✥** drag mode (select text, move sliders), the **input box** types any text (empty: Enter), and keys Esc, Tab, ⌫, Del, Enter, arrows, Ctrl/Alt/Shift/Win (apply to the next key), Home, End, PgUp, PgDn, F5. **Original** gives the window its size back and shows it scaled.

A window's size is written to `~/.handremote/restore.json` before it changes, and it gets it back when the phone closes it, when handremote stops, or (after a crash) on the next start.

## SYSTEM helper (optional)

Windows keeps a normal program's input out of administrator windows, UAC prompts and the lock screen. To reach those from the phone, install it once:

```sh
handremote helper install     # one UAC prompt
handremote helper status
handremote helper uninstall   # removes the task, the files and the policy change
```

It works like Chrome Remote Desktop's host: a startup task running as SYSTEM keeps an agent in the console session, which follows the desktop that takes input (the normal one, or the secure desktop).

- No network port. handremote talks to it over a named pipe only SYSTEM and the installing user can open, showing a secret only that user can read, on every connection.
- It runs copies in `%ProgramData%\handremote`, which only administrators can change.
- It turns on the `SoftwareSASGeneration` policy to send Ctrl+Alt+Del, and restores the old value on uninstall.
- Opened through handide's public link (`--public`, `--cloudflare`), the helper is not used, unless `"helperOnPublic": true` is in `~/.handremote/config.json`.

> [!IMPORTANT]
> With the helper, whoever has the link can type a PIN on the lock screen. Treat the link (`~/.handremote/token`) as a password; `handremote --new-token` stops every link handed out so far.

## With handide

When [handide](https://github.com/YangJongWon/handide) (your VS Code on your phone) runs on the same PC, its menu gets a **PC** tile. It opens through handide's address and token, so there is nothing else to bookmark, and web apps open in handide's preview. handremote writes a 127.0.0.1-only port and a secret to `~/.handremote/endpoint.json`; handide relays `/__handide/screen/` there with that secret.

## Command line

```
handremote [options]
  --port <n>       port (default 9100)
  --local          this PC only (http://localhost, no certificate)
  --no-remote      no Tailscale link (same Wi-Fi only)
  --ts-port <n>    the Tailscale HTTPS port (default 9443; 443 stays handide's)
  --new-token      replace the access token
```

`~/.handremote/config.json`: `quality` (JPEG quality, default 70), `helperOnPublic`.

## Scope and known limits

- **Windows 10/11** only for now; macOS later.
- Each window is captured with `PrintWindow`. Some GPU-accelerated windows come out black; then what the screen shows there is copied instead.
- Before input, the window is brought to the front. When Windows keeps another window in front, or another window covers the spot, **nothing is sent to the wrong window**: the phone says so.
- Windows that cannot be resized (dialogs, menus) keep their size and are fitted to the screen.
- Checks: `npm run check` starts its own Notepad and checks the list, the phone-size layout, Korean input, taps and the size coming back, in Pixel 7 and iPhone 14 emulation. The SYSTEM helper's UAC and lock screen need a check on a real PC.

## License

[MIT](LICENSE)
