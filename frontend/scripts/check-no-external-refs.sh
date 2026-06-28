#!/usr/bin/env bash
# R1 guard: shipped code must not name any analyzed third-party project as a design/code source.
# Klipper + Moonraker (platform) are allowed.
set -euo pipefail

PATTERN='mainsail|fluidd|octoprint|octoscreen|octodash|duetwebcontrol|guppyscreen|klipperscreen|klipper-touch|mobileraker|kiauh|ported from|inspired by|fork of'

# Scope = the shipped FRONTEND surface only. The deploy/ + scripts/ layer (outside these TARGETS)
# legitimately NAMES the KlipperScreen *service* to MANAGE it (Conflicts=, restore-on-uninstall when
# the native touch app takes over the display) - that's allowed-to-manage integration, like Klipper/
# Moonraker, not a lineage claim. This guard intentionally does NOT scan deploy/scripts; widening
# TARGETS to include them would be a deliberate decision, not a silent break of that integration.
TARGETS=(src index.html vite.config.ts package.json env.d.ts)

if grep -rniE "$PATTERN" "${TARGETS[@]}" 2>/dev/null; then
  echo "::error::R1 violation - external-project reference found (see matches above)."
  exit 1
fi
echo "R1 OK - no external-project references in the shipped surface."
