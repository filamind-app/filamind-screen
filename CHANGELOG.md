# Changelog

All notable changes to FilaMind screen are documented here. Format: `## [version]` sections (parsed by the release workflow).

## [0.1.0]

Initial on-printer **touch** app, built on `@filamind-app/core` and wrapped by Tauri 2.

- **Touch shell** — a three-tab UI (Status · Control · Settings) with a connection trust ribbon and the Klipper prompt dialog; keyboard (arrow / Home / End) tab navigation.
- **Machine control** — large gated buttons (Home / Pause / Resume / Cancel / Emergency-stop + safe-mode) through the core write-arbiter; an **always-on E-STOP** reachable from every tab.
- **Settings roaming** — the theme + language set on another FilaMind surface reach this screen on (re)connect.
- **Remote control** — receives UI-only commands (switch tab / message banner / locate flash) from another surface over Moonraker agent events.
- **Themes & i18n** — five themes (three Pharaonic + neutral light / dark); all 19 locale catalogs, with a CI key-diff gate keeping every locale at parity with English.
- **Tauri 2** — a fullscreen kiosk shell scaffolded to the standard layout (compiled separately once a Rust toolchain is available; see ARCHITECTURE.md).
- **Quality** — ESLint, Prettier, Vitest, an R1 no-external-refs guard, and the key-diff gate run in CI.
