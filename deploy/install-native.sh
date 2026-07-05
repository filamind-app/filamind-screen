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

case "${1:-}" in
  --uninstall) uninstall ;;
  "") ;;
  *) echo "usage: $0 [--uninstall]" >&2; exit 2 ;;
esac

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

# The unit must be written by Flow's single-source unit-writer (one display-stack detector for the
# whole suite). Require the Flow clone rather than shipping a divergent copy that could drift.
# Test for the file (-f), not the executable bit (-x): the script is always invoked via `bash …`
# below, and a git clone does not reliably set +x, so -x gave a false "Flow not found".
if [ ! -f "$FLOW_DIR/scripts/install.sh" ]; then
  echo "[native] FilaMind Flow is required (it owns the shared touch-UI installer) but was not found" >&2
  echo "         at $FLOW_DIR. Install FilaMind Flow first, then re-run - or set FILAMIND_FLOW_DIR." >&2
  exit 1
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
  bash "$FLOW_DIR/scripts/install.sh" sudoers-refresh >/dev/null 2>&1 || true
  if ! sudo -n apt-get --version >/dev/null 2>&1; then
    echo "[native] The native touch app needs extra host permissions that aren't in place yet." >&2
    echo "[native] Update FilaMind Flow (it grants them automatically), then install again." >&2
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

# -- 3. write the kiosk unit via Flow's single-source unit-writer (empty URL = no HTTP origin) ---
$SUDO "$BASH_BIN" "$FLOW_DIR/scripts/install.sh" kiosk --bin "$BIN" "$USER_NAME" "" "$SERVICE"

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

cat <<MSG

[native] Done. The FilaMind screen native print-control app is installed but NOT yet on the screen.
  Put it on the screen:  FilaMind Flow > Screen Manager > Touch UI > "Use"   (or: $SUDO systemctl start $SERVICE)
  KlipperScreen stays the boot default until you persist the switch (reboot-recoverable).
  Remove it:             bash deploy/install-native.sh --uninstall
MSG
