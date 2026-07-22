<div align="center">

# FilaMind Screen

A native touch app that puts print control on the printer's own screen, with big targets you can hit with a fingertip.

**Built by Egyptian makers, for world makers. Happy printing.** 🇪🇬

A small-team hobby project, built and tested on real printers. The code is all here to read.

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I119XEIV)

[![Status: experimental](https://img.shields.io/badge/status-experimental-E8A317)](#status-experimental)
[![CI](https://github.com/filamind-app/filamind-screen/actions/workflows/ci.yml/badge.svg)](https://github.com/filamind-app/filamind-screen/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/filamind-app/filamind-screen?color=111111&label=release&sort=semver)](https://github.com/filamind-app/filamind-screen/releases/latest)
[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-111111.svg)](LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-111111?logo=tauri&logoColor=white)](https://tauri.app)
[![Klipper](https://img.shields.io/badge/Klipper-compatible-111111)](https://www.klipper3d.org)
[![Moonraker](https://img.shields.io/badge/Moonraker-API-111111)](https://moonraker.readthedocs.io)

[Install](#install) · [Uninstall](#uninstall) · [What's on the screen](#whats-on-the-screen) · [Languages](#languages) · [Docs](#documentation) · [Support](#support)

</div>

## Status: experimental

> [!WARNING]
> **FilaMind Screen is under active development and research.**
> We are still shaping it toward a touch interface that stays light and quick while being genuinely
> enjoyable to use - so this app, and every feature tied to it, will keep changing between releases.
> Treat it as a preview rather than a settled product: expect rough edges, and keep your previous
> touch UI installed so you can switch back at any time (the installer and `--uninstall` both leave
> it in place). Suggestions and improvement ideas are genuinely welcome - open an issue any time.

FilaMind Screen is a native touchscreen app for your Klipper printer. It runs fullscreen on the printer's own display and talks straight to Moonraker, so the panel in front of the machine shows the same live job, the same big control buttons, and the same theme you set anywhere else in FilaMind. It ships as a prebuilt arm64 package for the small computers that drive most printer screens, so installing it never asks the host to compile anything.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/filamind-app/filamind-screen/main/deploy/install-native.sh | bash
```

This downloads the prebuilt arm64 app from the latest Release, installs it (apt resolves the WebKitGTK runtime it needs), and registers it with Moonraker so the panel can start and stop it. It needs `sudo`, so run it as your normal printer user and approve the prompt. Installing does **not** take over the screen on its own - your current touch UI stays the boot default, and you switch to FilaMind Screen from FilaMind Flow's Screen Manager (Touch UI → "Use"), or with `sudo systemctl start filamind-screen-kiosk`. Because the switch is not boot-enabled, a reboot always brings your old screen back, so trying it is risk-free.

> **Heads up:** this is the native on-screen path and targets arm64 printer hosts. It installs the app that FilaMind's CI built and leans on FilaMind Flow to write the screen-takeover service, so [install FilaMind Flow](https://github.com/filamind-app/filamind-flow) first. Just want to preview the touch UI in a browser on the printer? See [DEPLOY.md](DEPLOY.md) for the nginx/kiosk-browser path.

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/filamind-app/filamind-screen/main/deploy/install-native.sh | bash -s -- --uninstall
```

This restores your previous touch UI first (so the display is never left dark), then removes the FilaMind Screen service, the installed app, and its Moonraker registration. It also needs `sudo`.

## What's on the screen

FilaMind Screen is built for fingers, not a mouse. A three-tab bar runs along the bottom - **Status**, **Control**, **Settings** - and the deeper tools open as fullscreen overlays you reach from the Status face. A connection **trust ribbon** at the top always tells you whether the printer is live, and an **emergency stop** sits on every tab, one tap away.

| Area | What it does |
| ---- | ------------ |
| **Status** | The job face: a big progress ring with layer count, live hotend / bed / fan / speed tiles, a remaining-time estimate, and quick jumps to the tools below. |
| **Control** | Large, gated buttons - Home, Pause, Resume, Cancel (with a tap-to-confirm), Emergency-stop, and a Safe-mode toggle that locks out writes. |
| **Move** | A jog pad: XY directions, Z up/down (fed slower, so a stray tap can't drive the nozzle into the bed), a 0.1 / 1 / 10 / 100 mm step picker, per-axis and all-axis homing, disable steppers, and a live position readout that knows which axes are homed. |
| **Tune** | Live print tuning while it runs: speed, flow, Z baby-step, and part fan, each with coarse and fine nudges and a one-tap reset, read off the printer's live factors. |
| **Files** | Browse your g-code files (newest first, with size and date) and start the one you pick - blocked while a print is already running. |
| **Console** | Send any g-code and watch Klipper's responses stream back in a tidy, auto-scrolling log. |
| **Settings** | Pick a theme and a language right on the screen. |

Two things tie it into the rest of FilaMind. **Settings roam:** set a theme or language anywhere in FilaMind and this screen picks it up on the next connect. **Remote control:** another FilaMind surface can flip this screen to a tab, flash a "you are here" badge to tell which physical panel is which, or push a short message banner - all UI-only, never a hidden machine command.

Every machine action runs through one gated write path: it is refused unless the connection is live and Klipper is ready, and Safe-mode blocks writes on demand. Emergency stop is the deliberate exception - it always goes through, and it is logged.

## Tested on real printers

FilaMind Screen is developed and tested on a Sovol SV08 (CoreXY) driven by a BTT CB1 host - an arm64 board with a small touchscreen, the kind of low-RAM machine this app is built for. That constraint is why the screen is never built on the printer: the app you install is the one CI compiled, fetched as a ready-made package.

## How it's built

The interface is a Vue 3 single-page app, wrapped by a Tauri 2 native shell that opens it fullscreen on the printer's display. There is no app backend: the webview connects directly to Moonraker over its WebSocket and mirrors live printer state into a small shared store every view reads from. The interface ships in [19 languages](#languages), including right-to-left Arabic, with five themes. For the full picture, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Languages

The whole interface is translated into **19 languages** - every tab and tool, not just the chrome. Pick one in Settings; your choice is remembered, and on first run the app matches the printer's language. Set the language on another FilaMind surface and this screen follows along.

| | | | |
| --- | --- | --- | --- |
| English | Español | 简体中文 (Simplified Chinese) | 日本語 (Japanese) |
| العربية (Arabic, RTL) | Français | 繁體中文 (Traditional Chinese) | 한국어 (Korean) |
| Deutsch (German) | Русский (Russian) | Português (Brasil) | Tiếng Việt (Vietnamese) |
| Italiano | Nederlands (Dutch) | Polski (Polish) | Bahasa Indonesia |
| Türkçe (Turkish) | Українська (Ukrainian) | हिन्दी (Hindi) | |

Each language is a drop-in catalog folder, and CI holds every locale at parity with English, so a missing key fails the build rather than shipping.

## Develop

Everything but the native shell is verifiable with just Node (≥ 22.13):

```bash
cd frontend
npm install
npm run dev        # Vite dev server on :5274 - open it in a browser to preview the touch UI
npm run lint && npm run type-check && npm test && npm run i18n:keydiff && npm run build
```

Building the native app additionally needs a Rust toolchain and the system WebKitGTK packages:

```bash
cd frontend
npm run tauri -- icon src-tauri/icons/icon-source.png   # generate icons (one-time)
npm run tauri -- dev                                     # or: npm run tauri -- build
```

CI runs lint, formatting, type-check, tests, the locale key-diff, the build, an R1 no-external-references guard, and a native-shell compile on every push. The committed `frontend/dist` is the canonical bundle the printer serves, and CI keeps it fresh.

## Documentation

| Document | What's inside |
| -------- | ------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Design, layers, the write path, remote control, and build/deploy internals |
| [DEPLOY.md](DEPLOY.md) | Running and testing on a printer, including the browser/kiosk preview path |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## Support

FilaMind Screen is free and open source, built and maintained in spare time. If it made the panel in front of your printer nicer to use, a coffee helps keep the work going. Code, translations, and ideas are just as welcome.

<div align="center">

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I119XEIV)

</div>

## Credits

Built and maintained by the DeltaFabs team:

- Abdelmonem Awad - <eg2@live.com>
- Ahmed Bebars - <Ahmedbebars1@gmail.com>
- Kareem Salama - <Golden.kiko@gmail.com>

## License

[GPL-3.0-or-later](LICENSE) © 2026 DeltaFabs team.
