# FilaMind Screen roadmap

The on-printer touch UI's path from a working control panel to a complete, polished print-control
screen. One phase = one release; every phase ships with full i18n (19 locales), tests, and is
verified on real printer hardware before the next begins. Details of shipped work live in the
[CHANGELOG](CHANGELOG.md).

## Shipped

### v0.6.0 - Fit every panel, one uniform layout
- The window sizes and positions itself to the physical display at startup (works with or without
  a window manager), replacing the fixed-size window that overhung smaller panels.
- One proportional canvas: the root font size derives from the viewport (16px at the 1024x600
  reference, clamped for legibility), every dimension in `rem` - identical composition from
  3-inch panels up.
- Every screen lays out inside the visible height: lists scroll internally, controls never do.

### v0.7.0 - Core printer control
- Temperature tool: every heater the printer actually has (discovered live - multi-extruder,
  chamber, bed), tap-to-set targets on an on-screen number pad range-checked against the printer's
  own limits, material presets, all-off, read-only sensors.
- Filament tool: extrude/retract with length + speed presets, cold-extrusion guard with one-tap
  heat-up, load/unload when the printer defines those macros; blocked while a job is printing.
- Recovery: Restart / Firmware-restart surface on every tab whenever Klipper is down.
- Print takeover: a print starting from any surface switches the screen to the job face.

### v0.8.0 - Daily-use completeness
- Macros tool (user macros as one-tap buttons, internals hidden, blocked mid-print).
- File browser with real folders and a pre-print confirm card: estimated time, filament, embedded
  thumbnail.
- Direct value entry on the number pad for speed / flow / fan; console recall chips.
- Display settings (density, motifs, reduced animations) and app version.

## Planned

### v0.9.0 - Design-system reset
The foundation every later phase builds on:
- Design tokens: a typographic scale with oversized glanceable numerals, a 4pt spacing scale, two
  corner radii, and a touch-target floor (44px at the reference canvas) enforced everywhere.
- A single themed SVG line-icon set replacing all emoji and text glyphs, recolorable by theme.
- Shared UI primitives: tool header (direction-aware back), list rows, empty states with an icon +
  explanation + action, and a three-severity toast system replacing inline error text.
- Navigation restructure: a slim side icon rail makes every tool a first-class destination and
  returns the bottom tab bar's height to the content.
- A control store that handles concurrent writes (required for multi-control device panels).
- Density and motif settings wired to real visual effects.

### v0.10.0 - Core experience floor
- An on-screen keyboard that appears automatically for every input that needs it: a full QWERTY
  layout for text fields (console and any future text entry) and the numeric pad for numeric
  fields - nothing on the screen may require a physical keyboard. The pad gains decimal and
  negative entry (absolute Z-offset and signed values).
- Job face upgrade: the print's thumbnail on the status screen, elapsed time, and a blended
  time-remaining estimate with a wall-clock "finishes at" readout.
- A live temperature graph.
- Screen sleep/dim with tap-to-wake (and a short wake delay against ghost touches).
- Small-panel ergonomics pass: evaluate a physical floor for touch targets (the uniform canvas
  scales them down with the panel) and a scroll affordance for the navigation rail when the
  height budget clips it (e.g. 480x320 with the recovery strip visible).
- Remote-navigation parity: extend the cross-surface navigate command (shared core package and
  sender apps) to cover every rail destination, not just the original three views.

### v0.11.0 - Job depth
- Swappable stat grids on the job face (speed / flow / Z / pressure advance / layers).
- Live pressure-advance adjustment in the tune tool.
- End-of-print actions: reprint, save the babystepped Z offset.
- Exclude-object with a tappable bed map.
- A miniature print chip so the other tools stay usable mid-print without losing the job at a
  glance.

### v0.12.0 - Files, macros and console parity
- File sorting with a persisted order, a rich pre-print detail view, delete/rename with confirm,
  and live file-list sync from printer events.
- Macro parameter entry (default values parsed from the macro definitions).
- Persistent console history with prefix autocompletion.

### v0.13.0 - Device panels
- All configured fans (commit-on-release sliders), LEDs, and power devices.
- Filament runout sensor status + enable toggle.
- Gantry leveling actions (QGL / Z-tilt) where the printer defines them.
- Network/IP info, and Klipper / host restart & shutdown from Settings.

### v0.14.0 - Calibration cluster
- Bed-mesh heatmap with profile management.
- Bed-screws assistant with computed adjustments.
- A Z-offset / probe calibration wizard.
- Velocity-limit sliders and editable preheat presets sourced from the printer's config.

### v1.0.0 - Polish
- Webcam view, Spoolman, on-device Wi-Fi setup, a notification history, user-defined action
  buttons, and a guided filament-change wizard.

## Deliberately out of scope on the screen
Input-shaping analysis, belt diagnostics, and TMC driver tooling live in the FilaMind Flow web
app, which the whole suite shares - the screen links the journey rather than duplicating it.
