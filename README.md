# FilaMind screen

On-printer **touch control**, built on `@filamind-app/core` and wrapped by **Tauri 2** (a fullscreen kiosk webview).
Part of the FilaMind suite (3d web · screen touch · flow).

## What it is
A focused, big-target touch UI over the same core as FilaMind 3d: a tab shell (**Status · Control · Settings**),
the connection **trust ribbon**, the Klipper **prompt dialog**, and gated machine control (Home / Pause / Resume /
Cancel / Emergency-stop + safe-mode) through the core write-arbiter. The webview talks to Moonraker **directly**
via `@filamind-app/core` (set `VITE_MOONRAKER_WS_URL` to the printer).

## Stack
Vue 3.5 · Pinia 3 · vue-i18n 11 · Vite 8 · Tailwind 4 · TypeScript 6 (frontend) · Tauri 2 (Rust shell). Node ≥ 22.13.

## Layout
```
frontend/
  src/         core/ bridge (session·control·stores·theme·i18n·settings) + components/ + views/ + locales/ (en, ar)
  src-tauri/   Tauri 2 shell — Cargo.toml · tauri.conf.json (fullscreen + CSP) · src/{main,lib}.rs · capabilities/
```

## Develop
**Frontend** (fully verifiable now):
```bash
cd frontend
npm run dev          # Vite on :5274 (open in a browser to preview the touch UI)
npm run type-check && npm run lint && npm test && npm run build
```
**Tauri app** (needs the Rust toolchain + WebView2/WebKitGTK + app icons):
```bash
cd frontend
npm run tauri icon ./public/favicon.svg   # generate src-tauri/icons/* (one-time)
npm run tauri dev                          # or: npm run tauri build
```

## Status
**Frontend complete and green** (lint · type-check · test · build). The **Tauri shell is scaffolded** to the
standard Tauri 2 layout but has **not been compiled here** (no Rust toolchain in this environment) — building it
needs `cargo`/Tauri prerequisites and generated icons (above). Verify the Rust side when the toolchain is available.

GPL-3.0-or-later. R1: no third-party Klipper-UI/tool names in shipped code (guard in `frontend/scripts/check-no-external-refs.sh`).

## Credits

Built and maintained by the DeltaFabs team:

- abdelmonem awad - <eg2@live.com>
- Ahmed bebars - <Ahmedbebars1@gmail.com>
- Kareem Salama - <Golden.kiko@gmail.com>

## License

[GPL-3.0-or-later](LICENSE) © 2026 DeltaFabs team.
