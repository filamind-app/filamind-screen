# Changelog

All notable changes to FilaMind screen are documented here. Format: `## [version]` sections (parsed by the release workflow).

## [0.15.0]

### Added

- **Power devices panel.** A new Power destination lists the printer's Moonraker power devices (PSU,
  lights, ...) each with a live on/off switch. The rail tab appears only when the printer actually
  has power devices, the same capability-gating the Macros tab uses. Status stays live from
  Moonraker's `notify_power_changed` event (so a change from any surface or a physical button is
  reflected at once), a device `locked_while_printing` shows a lock instead of failing on tap, and
  every toggle is gated on a live connection. Fully translated across all 19 locales.
- **Live toolhead position on the job face.** While a job runs, the job face now shows live X / Y / Z
  (Z is the current print height) beneath the elapsed/finish line - an un-homed axis reads a dash
  rather than a misleading 0. Reuses the existing `move.position` string, so no new copy to
  translate.

## [0.14.0]

### Fixed

- **Screen sleep now truly powers the panel off.** Previously the idle screen only overlaid a black
  page while the backlight stayed lit at its floor, so it never actually went dark and the sleep
  timer looked broken. A new native `set_backlight_power` command drives the panel backlight to 0
  (past the visibility floor `set_backlight` keeps) and blanks it via `bl_power` when the screen
  sleeps, then un-blanks and restores your brightness on the first touch, heater warm-up, print
  start, or fault. Verified on the reference panel: the backlight measurably reaches zero. The
  must-stay-visible guards are unchanged - a live job, a hot heater, or a Klipper fault still keep
  the panel lit.
- **Backlight controls are actually writable by the app.** The shipped udev rule now `chmod`s the
  `brightness` and `bl_power` sysfs attributes to 0666 explicitly; the previous `MODE=` alone did
  not reliably apply to sysfs *attributes* on every udev version, which left the files root-only and
  silently blocked both dimming and sleep. Applied immediately by the install's `udevadm trigger`.

## [0.13.0]

### Changed

- **The native touch app now installs STANDALONE and no longer requires FilaMind Flow.**
  `deploy/install-native.sh` gained a bundled systemd unit-writer (`deploy/write-unit.sh`) that
  writes the same fullscreen bare-X (xinit) unit Flow produces (verified byte-identical on the
  device), so a printer host WITHOUT FilaMind Flow can install and run the screen. Flow's
  single-source writer is still preferred when Flow is present (one display-stack detector for the
  whole suite); the hard `exit 1`-when-Flow-absent is gone.
- **Auto-start at boot.** A standalone install now enables the unit and takes the display over from
  the existing touch UI by DEFAULT (reboot-persistent) - installing a screen app implies it
  should come up after a reboot, which it previously did not. A Flow host stays additive (Flow's
  Screen Manager owns the switch, and Moonraker update re-runs don't grab the panel); `--enable`
  forces the takeover, `--additive` opts out.
- The standalone path no longer depends on Flow's passwordless-sudo grant (used opportunistically
  only when Flow is present; a terminal install prompts for sudo). The service is still named
  `filamind-screen-kiosk` for compatibility with already-deployed hosts and Flow's switch_touch.

## [0.12.0]

### Added

- **Live temperature graph on the job face, with compact stat tiles (v0.12.0 "job depth").** The
  home screen's four stat tiles (hotend / bed / fan / speed) are shrunk to a compact grid, freeing
  the space beside the progress ring for a live temperature trend of every discovered heater - the
  same rolling history the Temperature tool plots, now glanceable straight from the job face.
- **End-of-print reprint (v0.12.0 "job depth").** When a job finishes (completed or cancelled), the
  job face offers a one-tap, full-width "Reprint" of the same file - replacing the dead, disabled
  Pause button that used to sit there. The action bar is now hidden entirely at standby. New
  `control.reprint` string translated across all 19 locales.
- **Live pressure advance in the Tune tool (v0.12.0 "job depth").** A fifth tuning card adjusts
  pressure advance live - nudge steps (+/-0.005, +/-0.02) or absolute numpad entry via
  `SET_PRESSURE_ADVANCE` - reading the extruder's current value and restoring the printer's
  configured default on Reset.
- **Miniature print chip (v0.12.0 "job depth").** While a job runs and you are in another tool, a
  small floating chip shows the live progress and filename and taps back to the job face - the print
  stays glanceable without leaving the tool you are in. Hidden on the job face itself.

### Fixed

- **Dropdown menus opened a light, un-themed popup.** A native `<select>` without a CSS
  `color-scheme` opens its option list in the OS light palette, ignoring the theme (light
  background, wrong colours). The dark themes now declare `color-scheme: dark` and the light theme
  `color-scheme: light`, so the popup matches the active theme; `option` rows are themed too.
- **The Tune tool's Reset buttons rendered a raw text glyph** (a bare `⟲`) instead of the themed
  icon set; they now use the SVG refresh icon like every other control.

## [0.11.7]

### Fixed

- **Home-screen progress ring drew a stray rectangular outline.** The `<svg class="ring">` collided
  with Tailwind's `.ring` utility (a 1px box-shadow), painting a square outline around the circular
  ring. Renamed the element's class to `.progress-ring`.
- **The ring's decorative motif sat off-centre.** Being intentionally larger than its container, the
  `inset:0; margin:auto` centring anchored the halo to one edge; it now uses transform-based
  centring and is concentric with the ring.
- **The percentage sat about 8px high inside the ring.** SVG text defaults to an alphabetic
  baseline; the number now uses `dominant-baseline: central` (nudged up only when a layer line shows
  beneath it).
- **The screen now wakes when a heater becomes hot while it is already asleep** (a remote or macro
  preheat started after the panel slept) - previously only a job start or a Klipper fault woke it,
  leaving a black panel over a hot nozzle.
- **The panel no longer stays Offline forever when it boots before Moonraker.** The first connect is
  retried on a capped exponential backoff (the session guard now resets on each failed attempt)
  instead of latching Offline with every write refused.
- **A boot-time failure no longer freezes the kiosk on the splash logo.** `bootstrap()` retries once
  on failure (a transient chunk/network error at cold boot self-heals) and otherwise replaces the
  splash with a message instead of hanging.
- The connection ribbon and the prompt dialog's text and spacing now scale with the device UI-size
  control, matching the rest of the app.

## [0.11.6]

### Fixed

- **Decorative motifs dimmed the entire screen, and a fresh panel booted faded - the real cause of
  the "faded" reports.** The motif's density-to-opacity rule was authored inside a component's
  scoped styles as `:global(:root[data-fm-motif='subtle']) .motif { opacity: .1 }`; the CSS minifier
  collapsed it to a bare `:root[data-fm-motif='subtle'] { opacity: .1 }` - dropping the `.motif`
  descendant and applying the opacity to `<html>` itself. Because the default motif density is
  "subtle", every fresh panel rendered the WHOLE page at 10% opacity, and the motif control behaved
  as an inverted screen dimmer (off = 100%, subtle = 10%, full = 25%). This is the same
  minifier-collapse class as the 0.11.5 RTL mirror bug. A repo-wide sweep found five rules with the
  same defect; all now live in the global stylesheet as plain selectors that target their real
  elements, not the root: the motif opacity, the reduced-motion "locating" frame, and the three
  docked-keyboard insets (toast host, console log, dialog re-open chip).
- **Jog / Home All / Disable steppers were not blocked during an active print.** The move tool gated
  only on `canWrite`, which is true mid-print, so tapping Home All (or a jog, or Disable) during a
  print injected G28 / G1 / M84 into the running job - fighting the print and risking a toolhead
  crash. It now applies the same `!printing` guard as the filament, macros, and files tools; a
  paused print stays movable for manual intervention.
- The docked on-screen keyboard no longer covers toasts, the console log's entry row, or the dialog
  re-open chip (same collapse fix).
- Reduced-motion mode no longer paints a stray 4px accent frame around the whole screen.

## [0.11.5]

### Fixed

- **Arabic no longer renders mirror-image (the real root cause).** A `:global([dir='rtl']) …`
  rule inside a component's scoped styles was collapsed by the CSS minifier into a bare
  `[dir='rtl'] { transform: scaleX(-1) }`. Because `dir=rtl` sits on `<html>`, that mirrored the
  ENTIRE page - text came out backwards and the RTL-flipped layout was flipped straight back, so
  Arabic looked reversed with a left-hand rail. The three RTL overrides now live in the global
  stylesheet as plain selectors that target only their own elements, so Arabic mirrors the layout
  (rail and E-STOP move to the right, text reads normally). Verified on the device's WebKitGTK.

### Fixed

- **Arabic layout mirrors to RTL (root cause).** The direction was being applied correctly (the
  attribute, the inline property, and the computed `direction` on every element all read `rtl`),
  but the kiosk's WebKitGTK does not re-flow an already-laid-out flex tree when the direction
  changes at runtime - so the rail and grid kept their left-to-right positions. The app now
  reloads once when the interface language flips between LTR and RTL; the boot script sets the
  direction before the first paint, so the whole layout is laid out mirrored from the start
  (confirmed on the device). Diagnosed by reading the live computed values on the panel.

## [0.11.3]

### Fixed

- **Arabic direction property.** Set the `direction` CSS property explicitly (superseded by
  0.11.4, which reloads on a direction flip so the flex tree is laid out fresh).

## [0.11.2]

### Fixed

- **Arabic direction (setLocale).** Direction is set synchronously when the language changes
  (superseded by 0.11.3, which also sets the `direction` CSS property so the layout mirrors).

## [0.11.1]

### Fixed

- **Arabic direction (partial).** First attempt: gave the document direction a single owner
  (superseded by 0.11.2, which sets it synchronously so it works on the device webview).

## [0.11.0]

### Changed

- **Restored legibility.** The first design-token pass shrank the touch-first UI too far - smaller
  buttons, tighter padding, and a lower type scale read as faint and cramped on the panel. Touch
  targets, padding, and the type scale are raised back to a clear, glanceable size (the theme
  colours are unchanged; only the sizing was at fault).

### Added

- **UI size.** One control (Small / Medium / Large / Extra) scales text, spacing, and touch
  targets together for this panel - a small screen and a large one each get a comfortable size.
  Device-local (it doesn't roam across surfaces). Replaces the old density toggle.
- **High-contrast mode.** Lifts the muted secondary text to full strength for bright rooms or low
  vision.
- **Brightness.** A backlight control that dims the panel (it boots at full, so this only lowers -
  useful at night). Device-local; the kiosk install ships a udev rule so the app can set the
  backlight without root (effective after the next reboot).

## [0.10.0]

### Added

- **On-screen keyboard.** A QWERTY keyboard docks automatically whenever any text input gains
  focus - nothing on the screen requires a physical keyboard. Tuned for what this device types
  (g-code, macro names, file names): digits row, the `: _ - . / = " *` symbols, a case toggle
  (uppercase default), and an enter key that submits the input's own form. The content insets
  itself so the focused input stays visible above the keys.
- **Signed and decimal number entry.** The number pad accepts a decimal point and a sign toggle
  where the value calls for it - starting with a range-checked absolute Z offset (±2 mm) in the
  Tune tool.
- **Job face upgrade.** The status screen now shows the job's own slicer thumbnail, the elapsed
  print time, and a wall-clock "ends ~HH:MM" estimate. Remaining time blends the slicer's
  estimate with the file-progress estimate, sliding from the former to the latter as the print
  progresses.
- **Live temperature graph.** The Temperature tool plots a rolling five-minute history of every
  discovered heater and sensor (sampled continuously in the background, so the graph is warm
  when opened) with a color-keyed legend of current readings.
- **Screen sleep.** The panel blanks after a configurable idle time (Settings → Display; off /
  1 / 5 / 15 minutes, stored per-device) - never while a job is active, while Klipper is in a
  shutdown/error state (the recovery strip and E-STOP must stay visible), or while any heater is
  hot; a job starting or a fault appearing wakes it. The waking tap is swallowed with a short
  guard so ghost touches cannot press a control underneath.

### Notes

- The keyboard activates keys on pointer-down (not click): on the kiosk's WebKitGTK engine a
  touch whose pointer-down is consumed never emits a click, so a click-driven keyboard would be
  dead on the device. It also closes itself if the focused field navigates away, never sampling
  a detached input.
- The remaining-time estimate drops the slicer figure once real elapsed time passes it, and the
  wall-clock finish tracks a live clock (and hides while paused) so it can't freeze on a past
  time. The temperature graph stops sampling while disconnected rather than drawing a fabricated
  flat line at a stale reading.

## [0.9.0]

### Changed

- **A coherent design system.** One typographic scale (with oversized, glanceable numerals on the
  live tiles), a single 4pt spacing scale, two corner radii, and a 44px reference touch floor now
  drive every dimension - replacing the ad-hoc values that made screens feel uncoordinated. The
  compact density setting now genuinely tightens spacing everywhere, and the motif setting draws a
  real (subtle/full) ornament.
- **A themed line-icon set.** Every emoji and text glyph is replaced by a single SVG icon set that
  recolors with the theme and renders identically on kiosk fonts; directional glyphs mirror in RTL
  by construction.
- **Navigation: a slim side rail.** Every tool - job face, temperature, filament, move, tune,
  files, macros, console, settings - is a first-class, always-visible destination. The bottom tab
  bar (and the extra hop through a Control tab) is gone, returning its height to the content; the
  Control tab's actions moved where they belong (cancel to the job face, safe mode to Settings,
  homing was already in Move).
- **Toasts instead of inline errors.** Failures now surface as auto-closing, tap-to-dismiss toasts
  (three severities) instead of red paragraphs that shifted the layout and never went away.
- **Shared screen primitives.** One tool header (direction-aware back button), one empty-state
  pattern with an icon and guidance, used by every screen - ending the per-screen drift.
- **Concurrent writes.** The control store now tracks writes as a refcount instead of dropping
  every call issued while another is in flight - required for panels that drive several controls.

### Fixed

- **Per-call write outcomes.** Actions that branch on success (prompt buttons, starting a print)
  now read their own call's result instead of a shared last-error that a concurrent write could
  overwrite or clear; a failed print start keeps the confirm card open.
- **Emergency-stop failures are never silent.** If the printer does not receive the E-STOP (e.g.
  connection already down), a persistent error toast says so instead of nothing changing on screen.
- **Pause/Cancel stay armed during other writes.** The write guard no longer folds the in-flight
  refcount into `canWrite`, so a long-running command cannot lock the job face's stop controls.
- **Refusals name their cause.** A safe-mode refusal now reads "safe mode is on" instead of
  "printer not live", and the job face shows a visible reason line when its actions are blocked.
- **Unambiguous safe-mode toggle.** The Settings row uses the same two-button On/Off segmented
  pattern as every other option (with a hint line), replacing a single button whose borrowed label
  read inverted in several languages.
- **Klipper prompts survive a stray tap.** A backdrop tap or Escape now tucks the prompt away
  behind a re-open chip instead of discarding it (the macro is still waiting for an answer), and
  prompt buttons disable while their g-code is in flight so a double-tap cannot run it twice.
- **Sticky failure toasts for destructive actions.** Failed pause/resume/cancel and heaters-off
  stay on screen until acknowledged instead of auto-closing.
- **RTL correctness.** The XY jog pad is pinned to the physical axis layout (a mirrored grid
  jogged X the wrong way), and console output/input and file names render LTR like other
  technical strings.
- **Icon-set completion.** The jog pad's home key and the number pad's backspace/OK use the themed
  icon set; extrude/retract use new arrow icons instead of emoji arrows.
- **Cleanup.** Dead per-view header/error CSS left by the shared-primitives migration is removed,
  along with orphaned locale keys in all 19 languages; the architecture doc's component tree
  matches the code again.

## [0.8.0]

### Added

- **Macros.** A new tool lists every user macro the printer defines (internal underscore-prefixed
  helpers stay hidden) as one-tap buttons; the shortcut appears on Status and Control only when the
  printer actually has macros.
- **Real file browsing.** The Files tool now walks folders, and starting a print goes through a
  confirm card showing what the slicer promised: estimated time, filament, and the embedded
  thumbnail.
- **Type a value anywhere.** Speed, flow, and fan in the Tune tool accept direct entry on the
  on-screen number pad (tap the value) - range-checked, alongside the existing nudge buttons.
- **Console recall.** Recently sent commands appear as tap-to-refill chips - no retyping on a
  touch panel.
- **Display settings.** Density, decorative motifs, and reduced animations are now on the Settings
  tab (the model always supported them), plus the app version.

## [0.7.0]

### Added

- **Temperature control.** A new Heat tool lists every heater the printer actually has (discovered
  live - multi-extruder, chamber, bed) with tap-to-set targets on an on-screen number pad,
  range-checked against the printer's own configured limits, plus one-tap PLA / PETG / ABS presets
  and an all-off button. Bare temperature sensors show read-only below. The Status temperature
  tiles now open it directly.
- **Filament tool.** Extrude / retract with length and speed presets, guarded by the printer's own
  cold-extrusion floor (with a one-tap heat-up when below it), and load / unload buttons when the
  printer defines those macros.
- **Recovery from shutdown.** When Klipper is down (after an emergency stop or an error) a recovery
  strip appears on every tab with the printer's message and Restart / Firmware-restart buttons - the
  screen can bring its own printer back instead of freezing until another UI helps.
- **Print takeover.** Starting a print from anywhere (a slicer upload, another UI) switches the
  screen to the job face automatically, like a printer display should.
- The idle Control tab now offers Temperature / Filament / Move shortcuts instead of three lonely
  buttons.

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
  suite). Registers with Moonraker. First-class `--uninstall` restores the previous screen before
  removing the binary; the full `uninstall` also removes the native unit so no orphan display owner
  is left.
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
