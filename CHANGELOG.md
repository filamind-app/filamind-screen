# Changelog

All notable changes to FilaMind screen are documented here. Format: `## [version]` sections (parsed by the release workflow).

## [0.3.0]

### Added

- **Move tool — a native jog panel for the touchscreen.** The Status action bar's "Move" button now
  opens a real jog tool (XY pad, Z up/down, a 0.1/1/10/100 mm step selector, per-axis + all homing,
  disable steppers, and a live homed-aware position readout) instead of falling back to the basic
  Control view. Every move goes through the same gated write path as the other controls (refused
  unless the printer is live and Klippy is ready); Z is fed slower than XY. Translated into all 19
  locales.

### Fixed

- **`deploy/install-native.sh`** no longer passes the removed `--native` flag to Flow's
  `install.sh kiosk`. Flow made its kiosk unit-writer native-only and it now takes only `--bin`; with
  the stale flag, the on-printer screen install treated `--native` as the username and failed.

## [0.2.0]

### Added

- **Installable on the printer's touchscreen.** CI now builds an arm64 `.deb` of the native touch
  app and attaches it to each Release (`filamind-screen-arm64.deb`).
- **`deploy/install-native.sh`** (and `install.sh native`): downloads the prebuilt `.deb` (never
  builds on the low-RAM host), installs it, and writes a `filamind-screen-kiosk` systemd unit by
  delegating to FilaMind Flow's single-source unit-writer (one display-stack detector for the whole
  suite). Registers with Moonraker. First-class `--uninstall` restores KlipperScreen before removing
  the binary; the full `uninstall` also removes the native unit so no orphan display owner is left.
  Switch to it (and back) from FilaMind Flow's Screen Manager (Touch UI); not boot-enabled, so any
  switch is reboot-recoverable.

## [0.1.3]

### Fixed

- **Installer no longer aborts on a `/dev/tty` error when run without a terminal.** The previous
  terminal-reconnect guard only checked that `/dev/tty` exists, but in a service context (no
  controlling terminal, e.g. when the FilaMind flow Setup widget runs the installer) the device
  node exists yet cannot be opened, so the script died with a cryptic
  `/dev/tty: No such device or address`. It now probes that the terminal actually opens before
  reconnecting; a headless run falls through and lets `sudo` print its clear "run on the host"
  guidance instead.

## [0.1.2]

### Changed

- **Installer guides the proper kiosk setup.** The post-install message now points to installing a
  dedicated `filamind-screen-kiosk` service (via FilaMind flow's installer) so the touch app runs on
  the printer's display and is switchable from flow's Screen Manager - not just a one-off chromium
  command.

## [0.1.1]

### Fixed

- **One-line installer can prompt for the sudo password.** Running `scripts/install.sh` via
  `curl … | bash` left stdin attached to the pipe, so the nginx setup failed with
  `sudo: a terminal is required to read the password`. It now reconnects the controlling terminal
  before the sudo step, so the one-liner works.

## [0.1.0]

Initial on-printer **touch** app, built on `@filamind-app/core` and wrapped by Tauri 2.

- **Touch shell** — a three-tab UI (Status · Control · Settings) with a connection trust ribbon and the Klipper prompt dialog; keyboard (arrow / Home / End) tab navigation.
- **Machine control** — large gated buttons (Home / Pause / Resume / Cancel / Emergency-stop + safe-mode) through the core write-arbiter; an **always-on E-STOP** reachable from every tab.
- **Settings roaming** — the theme + language set on another FilaMind surface reach this screen on (re)connect.
- **Remote control** — receives UI-only commands (switch tab / message banner / locate flash) from another surface over Moonraker agent events.
- **Themes & i18n** — five themes (three Pharaonic + neutral light / dark); all 19 locale catalogs, with a CI key-diff gate keeping every locale at parity with English.
- **Tauri 2** — a fullscreen kiosk shell scaffolded to the standard layout (compiled separately once a Rust toolchain is available; see ARCHITECTURE.md).
- **Quality** — ESLint, Prettier, Vitest, an R1 no-external-refs guard, and the key-diff gate run in CI.
