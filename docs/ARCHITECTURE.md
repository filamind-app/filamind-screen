# FilaMind Screen - Architecture

This document is the technical companion to the [README](../README.md). The README covers what the app is and how to install it; here we cover how it is put together - the layers, the live data and write paths, cross-surface remote control, and how the native app is built and deployed.

FilaMind Screen is the on-printer touch UI of the FilaMind suite. It is a Vue 3 single-page app wrapped by a Tauri 2 native shell that opens it fullscreen on the printer's display. It shares its session, control, theme, i18n, and settings layers with the rest of FilaMind through the `@filamind-app/core` package, so behaviour stays consistent across surfaces.

## Delivery forms

The same built frontend reaches the printer two ways:

- **Native (production).** A packaged Tauri 2 app - a native fullscreen kiosk webview - shipped as an arm64 `.deb`. This is what `deploy/install-native.sh` installs.
- **Browser preview (development).** The built SPA served by nginx and opened in a Chromium kiosk, no Rust required. This is what `deploy/install.sh` / `scripts/install.sh` set up; see [DEPLOY.md](../DEPLOY.md).

We never build on the printer. A Tauri/Rust build would exhaust a ~1 GB host, so the native app is compiled in CI and fetched as a prebuilt package.

## Layers

```
frontend/
  src/
    core/         bridge to @filamind-app/core: session · control · remote · theme · i18n · settings
      store/      Pinia mirror stores (session · control · settings) the views read from
    components/   TouchShell · TrustRibbon · PromptDialog · TabIcon
    views/        Status · Control · Settings (tabs) + Move · Tune · Files · Console (overlays)
    locales/      19 namespaced catalog folders (console/control/files/move/prompt/settings/shell/status/tune)
  src-tauri/      Tauri 2 Rust shell: Cargo.toml · tauri.conf.json · src/{main,lib}.rs · capabilities/
```

- **`core/`** is the composition root that wires `@filamind-app/core` into reactive state. The webview talks to Moonraker directly over its WebSocket; there is no app backend.
- **`components/` + `views/`** are the touch shell and its screens. The shell (`TouchShell.vue`) owns the brand bar, trust ribbon, always-on E-STOP, the bottom tab bar, and the prompt dialog. The three tabs (Status / Control / Settings) are a clean WAI-ARIA tablist with arrow / Home / End keyboard support; the deeper tools (Move / Tune / Files / Console) open as fullscreen overlays launched from the Status action bar, kept separate from the tab state so the bottom nav stays a tidy three-way.
- **`locales/`** holds one folder per language, each a set of namespaced JSON catalogs. CI key-diffs every locale against English.

## Session and live data

`core/session.ts` constructs a single `MoonrakerClient` and a `FilaMindSession` from the core package, identifying itself as a `display` surface so the host can tell screens apart from web surfaces. It subscribes to the full-control set of printer objects, and the session mirrors live state into the Pinia `session` store. Views read derived values from that store - temperatures, fan and speed factors, print progress, toolhead position and homed axes - and never touch the socket themselves.

The Moonraker URL is resolved in one place. `VITE_MOONRAKER_WS_URL` wins if set; otherwise, because the Tauri webview origin is `tauri.localhost` (not the printer), the screen defaults to `ws://localhost:7125/websocket` - the local Moonraker on the printer it runs on. A browser served by Moonraker derives the URL from its own origin instead.

The console needs the raw g-code response stream, which the session already consumes to parse `M117` prompts. Rather than let the console clobber the session's single callback sink, `session.ts` wraps `setCallbacks` once in the composition root and fans `notify_gcode_response` lines out to console subscribers, leaving every other callback untouched.

## The write path

Every machine mutation funnels through the core `WriteArbiter` in `core/control.ts`. The arbiter's guard allows a write only when the connection is live **and** Klippy reports `ready`, and Safe-mode locks all writes off on demand. The `useWriteGuard` composable exposes this as a reactive `canWrite` plus a human `blockedReason`, which every control surfaces as disabled buttons with an explanatory tooltip - so the same rule is enforced in the arbiter and reflected in the UI.

Concrete actions map to plain Moonraker/g-code calls behind the gate: Home (`G28`), Pause / Resume / Cancel, start a print, jog moves (`G91`/`G1`/`G90`, wrapped per-jog so the machine never lingers in relative mode), tuning (`M220` / `M221` / `SET_GCODE_OFFSET` / `M106`), and disable steppers (`M84`). **Emergency stop deliberately bypasses the gate** - it must work even when the printer is in a bad state - and is logged when fired.

## Cross-surface integration

Two features connect the screen to the rest of FilaMind, both built on the core session, neither able to issue a hidden machine command.

- **Settings roaming.** Theme and language live in the shared settings store. When another FilaMind surface changes them, the change reaches this screen on (re)connect; `i18n.ts` keeps vue-i18n's active locale in sync with the settings store, deduping a pick made locally in Settings.
- **Remote control.** `core/remote.ts` receives UI-only commands over Moonraker's agent-event bus. The core validates each event; this module accepts commands only from FilaMind surfaces and turns a valid one into touch-UI state: `navigate` switches the active tab (carrying a monotonic nonce so re-issuing the same tab still re-fires), `message` shows a timed banner with an accessible live region, and `locate` flashes a "you are here" badge so an operator can tell which physical screen is which. Commands are strictly UI-only by design, because the asserting client name is best-effort.

## Internationalization

`core/i18n.ts` bridges vue-i18n to the core locale metadata, which is the single source for the locale list, RTL flags, and plural rules. English is bundled eagerly; the other catalogs load lazily via `import.meta.glob`. The language switcher and locale detection both bind to the set of locales that actually ship a catalog on disk, so `<html lang>` is never set to a code with no messages. First-run detection falls back to the printer's language, then to English. Arabic switches the document to RTL.

## Build and deploy internals

- **Frontend:** `npm run build` runs the type-check then Vite, emitting `frontend/dist`. That bundle is committed and is what the printer serves, so CI is the canonical builder: on a PR it rebuilds and commits `dist` back to the branch; on `main` it sanity-checks a coherent committed bundle (bundler chunk hashes are not byte-reproducible across runs, so a strict match can't gate `main`).
- **Native app:** the Tauri shell (`src-tauri/`) targets WebKitGTK 4.1 (`webkit2gtk-4.1`) on Linux, with the standard GTK / libsoup3 / Rust prerequisites. The window is undecorated with a tightened CSP, and at startup (release builds on Linux) the shell sizes and positions itself to the physical display - the kiosk runs on a bare display server with no window manager, so the fullscreen hint alone is never honored there; explicit sizing fits the app to every panel exactly. CI compiles the shell on every push as a guard, and the Release workflow builds the arm64 `.deb` on an arm64 runner and attaches it to the Release under the stable name `filamind-screen-arm64.deb`.
- **Installers.** `deploy/install-native.sh` is the production path: it guards for arm64, downloads the `.deb` from the latest Release, installs it (apt resolves the WebKitGTK runtime), and delegates the screen-takeover systemd unit to FilaMind Flow's single-source unit-writer - so there is one display-stack detector for the whole suite, never a divergent copy that could leave two GUIs fighting over a 1 GB host. The unit (`filamind-screen-kiosk`) is registered with Moonraker but not boot-enabled, so switching to FilaMind Screen and back is always reboot-recoverable; `--uninstall` restores the previous screen before removing the binary. `deploy/install.sh` is the browser-preview path: an nginx site that serves the prebuilt SPA and reverse-proxies Moonraker on the same origin (no CORS), elevating only the narrow `cp`/`systemctl` steps so it can also run unattended from FilaMind Flow's Setup service.

## Conventions

- **No backend.** All server-side state is Moonraker's; the app is a pure client.
- **One write path.** Every mutation goes through the arbiter and `useWriteGuard`; emergency stop is the sole, logged exception.
- **Touch-first, one canvas.** The UI is a single proportional canvas: the root font size derives from the viewport (16px at the 1024×600 reference, clamped for legibility), every dimension is authored in `rem`, and each screen lays out inside the visible height (lists scroll internally, controls never do) - so every panel size from 3-inch up shows the identical composition. Big tap targets (min 2.75rem ≈ 44px at reference), the shell owns global affordances (brand, trust ribbon, E-STOP, nav), tools are fullscreen overlays.
- **R1 - no external-project references.** Shipped code names no third-party Klipper-UI or tool projects as lineage; a CI guard (`frontend/scripts/check-no-external-refs.sh`) enforces it.
- **Locale parity.** Every locale carries exactly the English key set, gated by `npm run i18n:keydiff` in CI.
