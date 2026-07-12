#!/usr/bin/env bash
# FilaMind screen - install the NATIVE print-control touch app on the printer's touchscreen.
#
# Downloads the prebuilt arm64 .deb (the Tauri print-control app that CI built) from the GitHub
# Release, installs it, and writes a `filamind-screen-kiosk` systemd unit that can take over the
# touchscreen from KlipperScreen - reversibly. The unit is NOT enabled at boot; you switch to it
# from FilaMind Flow's Screen Manager (Touch UI > "Use"). KlipperScreen stays the boot default.
#
# We never BUILD on the printer (a Tauri/Rust build would OOM a ~1 GB host) - we fetch the aarch64
# .deb CI already produced. The systemd unit is written by FilaMind Flow's single-source unit-writer
# (`scripts/install.sh kiosk --native`) so there is ONE display-stack detector for the whole suite,
# never a divergent copy that could drift (a stale Conflicts= list = two GUIs = OOM on 1 GB).
#
#   bash deploy/install-native.sh                # download + install the .deb + write the unit
#   bash deploy/install-native.sh --uninstall    # remove the unit + package, restore KlipperScreen
#
# `apt-get` (to install the .deb + its WebKit runtime) and the unit write need real root. With a
# terminal we prompt (host run); headless (the FilaMind Flow Setup widget) we use the passwordless
# grant Flow's installer writes for apt/dpkg + the kiosk unit-writer (scripts/install.sh sudoers),
# so a one-click native install works without ever hanging on a password prompt.
set -euo pipefail

REPO="filamind-app/filamind-screen"
ASSET="filamind-screen-arm64.deb"
SERVICE="filamind-screen-kiosk"      # the unit name flow's switch_touch expects
SCREEN_UNIT="KlipperScreen.service"
# FilaMind Flow owns the shared touch-UI unit-writer; find its clone.
FLOW_DIR="${FILAMIND_FLOW_DIR:-$HOME/filamind-flow}"
# This script's own directory (the deploy/ folder), for sibling assets like the udev rule.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

USER_NAME="$(id -un)"
PRINTER_DATA="${PRINTER_DATA:-$HOME/printer_data}"
ASVC="$PRINTER_DATA/moonraker.asvc"

if [ ! -t 0 ] && (exec </dev/tty) 2>/dev/null; then exec </dev/tty; fi

# Privileged steps: prompt when a terminal is attached (host run), else rely on the passwordless
# grant the FilaMind Flow Setup service installs (headless widget run) - never hang on a password.
if [ -t 0 ]; then SUDO="sudo"; else SUDO="sudo -n"; fi
BASH_BIN="$(command -v bash || echo /bin/bash)"

log() { echo "[native] $*"; }

restore_klipperscreen() {
  if systemctl list-unit-files "$SCREEN_UNIT" 2>/dev/null | grep -q "^$SCREEN_UNIT"; then
    $SUDO systemctl enable "$SCREEN_UNIT" || true
    $SUDO systemctl start "$SCREEN_UNIT" || true
  else
    log "WARNING: $SCREEN_UNIT is not installed - no display owner to restore to; leaving as-is."
  fi
}

deregister_moonraker() {
  [ -f "$ASVC" ] && sed -i "/^${SERVICE}\$/d" "$ASVC" 2>/dev/null || true
}

uninstall() {
  log "Removing the FilaMind screen native touch app…"
  $SUDO systemctl stop "${SERVICE}.service" 2>/dev/null || true
  $SUDO systemctl disable "${SERVICE}.service" 2>/dev/null || true
  $SUDO rm -f "/etc/systemd/system/${SERVICE}.service"
  $SUDO systemctl daemon-reload || true
  # Restore the display owner BEFORE removing the binary so there's never a dark-screen window.
  restore_klipperscreen
  local pkg
  pkg="$(dpkg -S /usr/bin/filamind-screen 2>/dev/null | cut -d: -f1 || true)"
  if [ -n "$pkg" ]; then
    $SUDO apt-get remove -y "$pkg" 2>/dev/null || $SUDO dpkg -r "$pkg" 2>/dev/null || true
  fi
  deregister_moonraker
  # Remove only the update_manager block we appended; leave other moonraker.conf sections intact.
  MCONF="$PRINTER_DATA/config/moonraker.conf"
  if [ -f "$MCONF" ] && grep -q "update_manager filamind-screen" "$MCONF"; then
    python3 - "$MCONF" <<'PY'
import re, sys
p = sys.argv[1]
open(p, "w").write(re.sub(r"\n\[update_manager filamind-screen\][^\[]*", "\n", open(p).read()))
PY
  fi
  $SUDO systemctl restart moonraker 2>/dev/null || true
  log "Removed. KlipperScreen is the display owner again."
  exit 0
}

# --enable / --additive control the boot behaviour (resolved after the Flow-presence check below):
#   default   STANDALONE (no Flow) enables at boot + takes the display over; a Flow host stays
#             additive so Flow's Screen-Manager keeps owning the switch (no surprise takeover, and
#             Moonraker's update re-runs don't grab the panel).
#   --enable  force enable-at-boot + display takeover now (what a direct screen install implies).
#   --additive / --no-enable  write the unit only; don't enable or switch (Flow's model).
ENABLE_AT_BOOT=""
for arg in "$@"; do
  case "$arg" in
    --uninstall) uninstall ;;
    --enable) ENABLE_AT_BOOT=1 ;;
    --additive | --no-enable) ENABLE_AT_BOOT=0 ;;
    "") ;;
    *) echo "usage: $0 [--uninstall] [--enable|--additive]" >&2; exit 2 ;;
  esac
done

# -- 0. full clone + tags --------------------------------------------------------------------
# Repair a legacy --depth 1 (shallow) screen clone so Moonraker's update_manager reads a real
# version, not "v0.0.0-...-inferred". Runs on install AND whenever Moonraker re-runs this script.
SCREEN_DIR="${FILAMIND_SCREEN_DIR:-$HOME/filamind-screen}"
if [ -d "$SCREEN_DIR/.git" ]; then
  [ -f "$SCREEN_DIR/.git/shallow" ] && git -C "$SCREEN_DIR" fetch --unshallow --tags origin 2>/dev/null || true
  git -C "$SCREEN_DIR" fetch --tags origin 2>/dev/null || true
fi

# -- 1. arch guard + fetch the prebuilt .deb -----------------------------------------------------
ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
case "$ARCH" in
  arm64 | aarch64) ;;
  *) echo "[native] This touch app targets arm64; this host is '$ARCH'. Aborting." >&2; exit 1 ;;
esac

# The systemd unit is ideally written by Flow's single-source unit-writer (one display-stack
# detector for the whole suite) when Flow is installed - but the screen must ALSO install and run
# STANDALONE, so fall back to the bundled writer (deploy/write-unit.sh) when Flow is absent.
# Test for the file (-f), not the executable bit (-x): a git clone does not reliably set +x.
if [ -f "$FLOW_DIR/scripts/install.sh" ]; then
  USE_FLOW_WRITER=1
else
  USE_FLOW_WRITER=0
  log "FilaMind Flow not found at $FLOW_DIR - installing STANDALONE (bundled unit-writer)."
fi

# Resolve the boot behaviour if no flag forced it: standalone auto-starts, a Flow host stays additive.
if [ -z "$ENABLE_AT_BOOT" ]; then
  [ "$USE_FLOW_WRITER" = 0 ] && ENABLE_AT_BOOT=1 || ENABLE_AT_BOOT=0
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
DEB_URL="https://github.com/$REPO/releases/latest/download/$ASSET"
log "Downloading $ASSET from the latest Release…"
curl -fL "$DEB_URL" -o "$TMP/$ASSET" \
  || { echo "[native] Could not download $DEB_URL - is there a published Release with the .deb asset?" >&2; exit 1; }

# -- 2. install it (apt resolves the libwebkit2gtk-4.1 runtime dep) ------------------------------
# Headless preflight: installing the .deb needs root via passwordless sudo (SUDO="sudo -n"). When
# the apt/dpkg grant is missing (e.g. a host whose grant predates the native-install rules),
# auto-heal it via Flow's passwordless sudoers refresh - it re-applies the current grant using the
# base `sudo -n cp` right the panel already has - then re-check. Never ask the user to run a sudo
# command by hand; if the base grant is absent too, point them at updating Flow (which grants it).
if [ "$SUDO" = "sudo -n" ] && ! sudo -n apt-get --version >/dev/null 2>&1; then
  log "Setting up the native-install permissions…"
  # Opportunistically use Flow's passwordless sudoers refresh when Flow is present; a standalone
  # host has no such grant, so a headless (no-tty) install there needs the grant set up first.
  [ "$USE_FLOW_WRITER" = 1 ] && bash "$FLOW_DIR/scripts/install.sh" sudoers-refresh >/dev/null 2>&1 || true
  if ! sudo -n apt-get --version >/dev/null 2>&1; then
    echo "[native] The native touch app needs apt/dpkg as root, but this is a headless run with no" >&2
    echo "[native] passwordless grant. Re-run from a terminal (it prompts for sudo), or - with" >&2
    echo "[native] FilaMind Flow installed - update Flow, which grants it automatically." >&2
    exit 1
  fi
fi
log "Installing the .deb (apt resolves the WebKit runtime dep)…"
$SUDO apt-get install -y "$TMP/$ASSET" \
  || { $SUDO dpkg -i "$TMP/$ASSET" || true; $SUDO apt-get -y -f install; }

PKG="$(dpkg-deb -f "$TMP/$ASSET" Package 2>/dev/null || echo filamind-screen)"
BIN="$(dpkg -L "$PKG" 2>/dev/null | grep -E '^/usr/bin/' | head -1 || true)"
[ -n "$BIN" ] || BIN="/usr/bin/filamind-screen"
log "Installed binary: $BIN"

# -- 3. write the unit: Flow's single-source writer when present, else the bundled standalone writer
#    (empty URL = the native app, launched directly - no HTTP origin) -------------------------------
if [ "$USE_FLOW_WRITER" = 1 ]; then
  $SUDO "$BASH_BIN" "$FLOW_DIR/scripts/install.sh" kiosk --bin "$BIN" "$USER_NAME" "" "$SERVICE"
else
  $SUDO "$BASH_BIN" "$SCRIPT_DIR/write-unit.sh" --bin "$BIN" "$USER_NAME" "" "$SERVICE"
fi

# -- 3b. backlight: install the udev rule that lets the unprivileged app control the panel backlight
#    (dim it, and power it off for screen sleep). The trigger below applies it now; without the rule
#    the panel just stays fixed and screen sleep can only overlay black. Best-effort. --------------
BL_RULE="$SCRIPT_DIR/99-filamind-backlight.rules"
if [ -f "$BL_RULE" ]; then
  $SUDO cp "$BL_RULE" /etc/udev/rules.d/99-filamind-backlight.rules 2>/dev/null \
    && log "Backlight udev rule installed." || true
  $SUDO udevadm control --reload 2>/dev/null || true
  $SUDO udevadm trigger --subsystem-match=backlight --action=add 2>/dev/null || true
fi

# -- 4. register with Moonraker: the service allowlist (start/stop/restart from the panel) AND the
#    update_manager (so the screen app shows in the updates panel and gets git-updated). -----------
if [ -f "$ASVC" ]; then
  grep -qx "$SERVICE" "$ASVC" || echo "$SERVICE" >> "$ASVC"
fi
MCONF="$PRINTER_DATA/config/moonraker.conf"
if [ -f "$MCONF" ] && ! grep -q "update_manager filamind-screen" "$MCONF"; then
  cp "$MCONF" "$MCONF.bak.filamind.$(date +%s)" 2>/dev/null || true
  cat >> "$MCONF" <<'EOF'

[update_manager filamind-screen]
type: git_repo
path: ~/filamind-screen
origin: https://github.com/filamind-app/filamind-screen.git
primary_branch: main
is_system_service: False
install_script: deploy/install-native.sh
EOF
fi
$SUDO systemctl restart moonraker 2>/dev/null || true

# -- 5. auto-start at boot (the standalone default). Installing a screen app implies it should come
#    up after a reboot, so take the display over from KlipperScreen/guppyscreen (the unit's
#    Conflicts= list also stops them at runtime) and enable the unit. --additive skips this.
if [ "$ENABLE_AT_BOOT" = 1 ]; then
  $SUDO systemctl daemon-reload || true
  $SUDO systemctl disable --now KlipperScreen.service 2>/dev/null || true
  $SUDO systemctl disable --now guppyscreen.service 2>/dev/null || true
  $SUDO systemctl enable "${SERVICE}.service" 2>/dev/null || true
  $SUDO systemctl restart "${SERVICE}.service" 2>/dev/null \
    || $SUDO systemctl start "${SERVICE}.service" 2>/dev/null || true
  log "Enabled $SERVICE at boot and switched the display to it (now + after every reboot)."
fi

if [ "$ENABLE_AT_BOOT" = 1 ]; then
cat <<MSG

[native] Done. The FilaMind screen native touch app is installed, running, and set to start at boot.
  It took the display over from KlipperScreen (reversible).
  Keep KlipperScreen at boot instead:  re-run with --additive, then switch from Flow's Screen Manager.
  Remove it (restores KlipperScreen):  bash deploy/install-native.sh --uninstall
MSG
else
cat <<MSG

[native] Done. The FilaMind screen native touch app is installed but NOT yet on the screen (--additive).
  Put it on the screen:  FilaMind Flow > Screen Manager > Touch UI > "Use"   (or: $SUDO systemctl start $SERVICE)
  Enable it at boot:     bash deploy/install-native.sh --enable
  Remove it:             bash deploy/install-native.sh --uninstall
MSG
fi
