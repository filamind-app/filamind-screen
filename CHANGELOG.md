# Changelog

All notable changes to FilaMind screen are documented here. Format: `## [version]` sections (parsed by the release workflow).

## [0.6.0]

### Fixed

- **The UI now always fits the physical screen.** The window was hard-coded to 1024x600, and on the
  kiosk (a bare display server with no window manager) the fullscreen request is never honored - so
  on a smaller panel (e.g. 800x480) the app rendered past the screen edges and the whole bottom tab
  bar was physically off-screen. The app now sizes and positions itself to the actual display at
  startup, on every panel size, with or without a window manager.
- **One unified layout on every screen size.** The interface is now a single proportional canvas:
  its base unit derives from the viewport (reference 16px at 1024x600, bounded for legibility), so
  a 3-inch panel and a 10-inch one show the identical composition - the same screens, just scaled.
  Previously everything was fixed-density, designed only for 1024x600.
- **No more scrolled-away or crushed controls.** Each screen now lays out inside the visible height
  (lists scroll internally; controls never do): the Move screen was restructured so the jog pad is
  sized by the available height (it used to grow past the screen on every panel), the Status action
  row wraps instead of crushing its buttons on narrow panels, the four tuning cards sit in a 2x2
  grid, and dialogs cap their height. The bottom tab highlight also no longer points at a stale tab
  while a tool screen is open.

## [0.5.3]

### Fixed

- **No more Moonraker "not permitted to restart service" warning.** The `[update_manager
  filamind-screen]` block now sets `is_system_service: False` - the entry tracks the source repo, it
  is not itself a systemd service (the kiosk unit is `filamind-screen-kiosk`), and the update
  `install_script` already handles the restart.

## [0.5.2]

### Fixed

- **The native app now launches on older printer hosts.** The release `.deb` was built on a
  glibc-2.39 runner, so on a glibc-2.36 host (e.g. Armbian bookworm) the binary refused to start
  (`GLIBC_2.39 not found`) - the kiosk started then immediately exited, so "Use" never showed the
  screen. The `.deb` is now built in the same Debian Bookworm (glibc 2.36) container `bundle.yml`
  uses, so it runs on the widest range of hosts (bookworm through trixie).
- **No more Moonraker warning about `managed_services`.** The `[update_manager filamind-screen]`
  block declared `managed_services: filamind-screen-kiosk`, which Moonraker rejects (it only allows
  the entry's own name plus `klipper`/`moonraker`). Dropped it - the `install_script` already
  reinstalls the `.deb` and restarts the kiosk on update.

## [0.5.1]

### Fixed

- **The native install no longer asks you to run a sudo command by hand.** When the host permissions
  the `.deb` install needs aren't in place yet, the installer now grants them automatically through
  FilaMind Flow's passwordless self-heal and continues - instead of stopping and printing a
  `sudo bash … install.sh sudoers` line. If the base permissions are missing entirely, it points you
  at updating FilaMind Flow rather than at a shell command.

## [0.5.0]

### Added

- **Fill-the-screen touch layout** with a language dropdown.
- **Native install registers the screen kiosk** with Moonraker's `update_manager` (shows in the
  printer's update list and reports a real version).

### Changed

- Native install now works **headless** (no TTY) via the Flow sudo grant, survives a **stale clone**,
  and does a full clone + fetched tags so Moonraker shows a real version.
- Fixed Flow detection in the native installer (`-f`, not `-x`).
- Modernized README + added `docs/ARCHITECTURE.md`; ASCII-only published text.

## [0.4.0]

### Added

The print-control screen gains its remaining three touch tools — the Status action bar's
Move / Tune / Files / Console buttons are now all real (they were stubs that fell back to the basic
Control view). Each opens as a full-screen overlay and routes every write through the same gated
control path (refused unless the printer is live and Klippy is ready).

- **Tune** — live print tuning: speed (`M220`), flow (`M221`), Z baby-step (`SET_GCODE_OFFSET`),
  part fan (`M106`), each with coarse/fine steps and a reset, read off the live factors.
- **Files** — browse the Moonraker `gcodes` root (newest first, with size + date) and start the
  selected file; blocked while a print is already running.
- **Console** — send any g-code and watch Klipper's responses stream back in a bounded,
  auto-scrolling log (via a `notify_gcode_response` tee in the session, so the console gets the
  stream without disturbing the rest of the app).

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
