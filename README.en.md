# AutoAccept Lite

A Windows tray app that automatically handles selected approval buttons in the standalone Antigravity desktop app.

**[English](README.en.md) · [Türkçe](README.tr.md)**

## Windows app

Run `AutoAcceptLite-Kurulum-1.1.2.exe` and complete setup. The installer includes Node.js and the `ws` dependency. With Antigravity open, launch **AutoAccept Lite** from its shortcut. The app starts without showing a console and runs in the Windows notification area.

The latest source revision is 1.1.2: it fixes the tray launcher's log bug that froze the engine, and the interface now opens in Turkish or English depending on the Windows display language. To build the installer from source, follow [`packaging/windows/README.md`](packaging/windows/README.md).

Right-click the AutoAccept Lite icon in the notification area:

- **Show log:** displays status and error output. Double-clicking the icon also opens it.
- **Pause / Resume:** temporarily stops or resumes automatic clicks.
- **Restart engine:** restarts the engine after a settings change or if it stopped.
- **Exit:** removes the observer from Antigravity pages and closes the app.

Windows may place the icon behind the hidden-icons arrow. The log window is hidden at startup; closing it only hides it. AutoAccept Lite does not add itself to Windows startup.

The language follows the Windows display language: Turkish if it is Turkish, English otherwise. To force one, set `"language"` to `"tr"` or `"en"` in `config.json`. Task Manager shows the app as two rows: **AutoAccept Lite** (notification area) and **Node.js JavaScript Runtime** (engine).

## Developer setup

Use Node.js 22 or a compatible current release:

```powershell
npm ci
npm start
```

In developer mode, press `P` in the terminal to pause/resume and `Ctrl+C` to exit. See [`packaging/windows/README.md`](packaging/windows/README.md) for Windows installer build instructions.

## How it works

The app discovers Antigravity's local Chrome DevTools Protocol (CDP) endpoint, monitors open renderer windows, and uses a `MutationObserver` to watch for matching buttons. It does not install into Antigravity, VS Code, or an extension host. It does not open its own CDP port or connect to another machine; the CDP connection uses `127.0.0.1`.

## Safety notes

- Several known destructive command patterns are blocked by default. The list is in `src/config.js`; additional blocked and allowed patterns can be set in `config.json`.
- If command text cannot be read, the filter may not recognize a risky command. The safety filter is not a complete security boundary.
- `customButtonTexts` includes `submit` by default. This may submit an empty answer and continue without your input. Remove `submit` from `config.json` if you do not want this behavior.
- `autoAcceptFileEdits` is enabled by default. Set it to `false` if you want to review file edits yourself.
- Review the source and default settings before distributing a build, and choose settings appropriate for your use.

## Licenses

This project is licensed under the MIT License; see [`LICENSE`](LICENSE). `src/DOMObserver.js` is based on the MIT-licensed [AntiGravity-AutoAccept](https://github.com/yazanbaker94/AntiGravity-AutoAccept) project. Its original copyright and license notice are preserved in [`LICENSE.upstream`](LICENSE.upstream).

The bundled Node.js runtime in the Windows installer is subject to OpenJS Foundation license terms. Its notices are shipped as `LICENSE.node.txt` in the installer.
