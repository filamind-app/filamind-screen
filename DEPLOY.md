# Deploy & test FilaMind screen on a printer

FilaMind screen is the on-printer **touch** UI on `@filamind-app/core`. The eventual production form is
a packaged **Tauri 2 kiosk app**, but for a preliminary test you can run the built SPA in a browser /
Chromium kiosk on the printer's display - no Rust toolchain required.

## Preliminary test - browser / kiosk (no Tauri)

nginx serves the touch SPA and reverse-proxies Moonraker on the same origin (no CORS; the app
auto-resolves `ws://<host>:<port>/websocket`):

```bash
# on the printer, as a sudo-capable user:
sudo bash deploy/install.sh --port 8088 --moonraker 127.0.0.1:7125
# then on the printer's touchscreen:
chromium-browser --kiosk http://localhost:8088/      # or: chromium --kiosk …
sudo bash deploy/install.sh --uninstall              # to remove
```

If `frontend/dist` isn't present the script builds it (Node 22 + npm). Or build elsewhere
(`npm ci && npm run build` in `frontend/`) and copy `frontend/dist` to the printer first.

## Production - Tauri 2 kiosk (later)

The Tauri shell is scaffolded under `frontend/src-tauri/` but not compiled yet (needs the Rust
toolchain). When Rust is available:

```bash
cd frontend
npm run tauri icon ./public/favicon.svg   # generate icons (one-time)
npm run tauri build                        # native fullscreen kiosk bundle
```

Set `VITE_MOONRAKER_WS_URL` if the screen isn't on the same host as Moonraker (in the Tauri bundle
the webview origin is `tauri.localhost`, so it defaults to `ws://localhost:7125/websocket`).

## Preliminary test checklist

1. App opens fullscreen; the **trust ribbon** goes **Live** when Klipper is ready.
2. The three tabs - **Status · Control · Settings** - switch by touch and by keyboard (arrows).
3. **Status** shows the big temp tiles + print progress; **Control** has large gated buttons.
4. **Klipper prompts** appear as a focus-managed touch dialog.
5. **Settings roam**: theme/locale set on FilaMind 3d reach this screen on (re)connect.
6. **Remote control**: from FilaMind 3d, "Printer screen → …" / "Locate" switches this screen's tab,
   shows a banner, or flashes it.
