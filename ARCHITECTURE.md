# FilaMind screen - architecture

FilaMind screen is the on-printer **touch** UI built on `@filamind-app/core`, delivered two ways:

- **Preliminary / dev** - the built SPA served by nginx (or any static host) and opened in a Chromium kiosk; no Rust needed (see [DEPLOY.md](DEPLOY.md)).
- **Production** - a packaged **Tauri 2** desktop app (a native fullscreen kiosk webview).

## Layers

- `frontend/src/core/` - the bridge to `@filamind-app/core`: session, control, theme, i18n, settings, and the Pinia mirror stores. The webview talks to Moonraker **directly** over its WebSocket (`VITE_MOONRAKER_WS_URL`); there is no app backend.
- `frontend/src/components/` + `frontend/src/views/` - the touch shell (`TouchShell`), trust ribbon, prompt dialog, and the Status / Control / Settings views.
- `frontend/src/locales/` - 19 namespaced locale catalogs, key-diff gated in CI.
- `frontend/src-tauri/` - the Tauri 2 Rust shell: `Cargo.toml`, `tauri.conf.json` (fullscreen + CSP), `src/{main,lib}.rs`, `capabilities/`.

## Tauri / webview requirements

- **Linux (the printer):** Tauri uses the system **WebKitGTK** runtime. Target **WebKitGTK 4.1** (`webkit2gtk-4.1`) - the line Tauri 2 builds against; systems that only ship the older 4.0 packages need the 4.1 ones added. Build prerequisites: a Rust toolchain plus the standard GTK / libsoup3 / webkit2gtk-4.1 dev packages.
- **Origin:** in the Tauri bundle the webview origin is `tauri.localhost`, so the Moonraker URL defaults to `ws://localhost:7125/websocket` unless `VITE_MOONRAKER_WS_URL` is set (use it when the screen is not on the same host as Moonraker).

## Build

- **Frontend:** `npm ci && npm run build` in `frontend/` → `frontend/dist` (servable as-is for the preliminary path).
- **Tauri:** `npm run tauri icon ./public/favicon.svg` (one-time) then `npm run tauri build` (needs the toolchain above).
