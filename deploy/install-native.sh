#!/usr/bin/env bash
# FilaMind screen — install the NATIVE print-control touch app on the printer's touchscreen.
#
# Downloads the prebuilt arm64 .deb (the Tauri print-control app that CI built) from the GitHub
# Release, installs it, and writes a `filamind-screen-kiosk` systemd unit that can take over the
# touchscreen from KlipperScreen — reversibly. The unit is NOT enabled at boot; you switch to it
# from FilaMind Flow's Screen Manager (Touch UI > "Use"). KlipperScreen stays the boot default.
#
# We never BUILD on the printer (a Tauri/Rust build would OOM a ~1 GB host) — we fetch the aarch64
# .deb CI already produced. The systemd unit is written by FilaMind Flow's single-source unit-writer
# (`scripts/install.sh kiosk --native`) so there is ONE display-stack detector for the whole suite,
# never a divergent copy that could drift (a stale Conflicts= list = two GUIs = OOM on 1 GB).
#
#   bash deploy/install-native.sh                # download + install the .deb + write the unit
#   bash deploy/install-native.sh --uninstall    # remove the unit + package, restore KlipperScreen
#
# NOTE: `apt-get` (to install the .deb) and the unit write need real root. The narrow FilaMind
# sudoers grant covers only systemctl/cp, so this needs INTERACTIVE sudo (or a one-time broad grant).
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

log() { echo "[native] $*"; }

restore_klipperscreen() {
  if systemctl list-unit-files "$SCREEN_UNIT" 2>/dev/null | grep -q "^$SCREEN_UNIT"; then
    sudo systemctl enable "$SCREEN_UNIT" || true
    sudo systemctl start "$SCREEN_UNIT" || true
  else
    log "WARNING: $SCREEN_UNIT is not installed — no display owner to restore to; leaving as-is."
  fi
}

deregister_moonraker() {
  [ -f "$ASVC" ] && sed -i "/^${SERVICE}\$/d" "$ASVC" 2>/dev/null || true
}

uninstall() {
  log "Removing the FilaMind screen native touch app…"
  sudo systemctl stop "${SERVICE}.service" 2>/dev/null || true
  sudo systemctl disable "${SERVICE}.service" 2>/dev/null || true
  sudo rm -f "/etc/systemd/system/${SERVICE}.service"
  sudo systemctl daemon-reload || true
  # Restore the display owner BEFORE removing the binary so there's never a dark-screen window.
  restore_klipperscreen
  local pkg
  pkg="$(dpkg -S /usr/bin/filamind-screen 2>/dev/null | cut -d: -f1 || true)"
  if [ -n "$pkg" ]; then
    sudo apt-get remove -y "$pkg" 2>/dev/null || sudo dpkg -r "$pkg" 2>/dev/null || true
  fi
  deregister_moonraker
  sudo systemctl restart moonraker 2>/dev/null || true
  log "Removed. KlipperScreen is the display owner again."
  exit 0
}

case "${1:-}" in
  --uninstall) uninstall ;;
  "") ;;
  *) echo "usage: $0 [--uninstall]" >&2; exit 2 ;;
esac

# ── 1. arch guard + fetch the prebuilt .deb ─────────────────────────────────────────────────────
ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
case "$ARCH" in
  arm64 | aarch64) ;;
  *) echo "[native] This touch app targets arm64; this host is '$ARCH'. Aborting." >&2; exit 1 ;;
esac

# The unit must be written by Flow's single-source unit-writer (one display-stack detector for the
# whole suite). Require the Flow clone rather than shipping a divergent copy that could drift.
if [ ! -x "$FLOW_DIR/scripts/install.sh" ]; then
  echo "[native] FilaMind Flow is required (it owns the shared touch-UI installer) but was not found" >&2
  echo "         at $FLOW_DIR. Install FilaMind Flow first, then re-run — or set FILAMIND_FLOW_DIR." >&2
  exit 1
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
DEB_URL="https://github.com/$REPO/releases/latest/download/$ASSET"
log "Downloading $ASSET from the latest Release…"
curl -fL "$DEB_URL" -o "$TMP/$ASSET" \
  || { echo "[native] Could not download $DEB_URL — is there a published Release with the .deb asset?" >&2; exit 1; }

# ── 2. install it (apt resolves the libwebkit2gtk-4.1 runtime dep) ──────────────────────────────
log "Installing the .deb (needs sudo for apt)…"
sudo apt-get install -y "$TMP/$ASSET" \
  || { sudo dpkg -i "$TMP/$ASSET" || true; sudo apt-get -y -f install; }

PKG="$(dpkg-deb -f "$TMP/$ASSET" Package 2>/dev/null || echo filamind-screen)"
BIN="$(dpkg -L "$PKG" 2>/dev/null | grep -E '^/usr/bin/' | head -1 || true)"
[ -n "$BIN" ] || BIN="/usr/bin/filamind-screen"
log "Installed binary: $BIN"

# ── 3. write the kiosk unit via Flow's single-source unit-writer (empty URL = no HTTP origin) ───
sudo bash "$FLOW_DIR/scripts/install.sh" kiosk --bin "$BIN" "$USER_NAME" "" "$SERVICE"

# ── 4. register with Moonraker so the panel can start/stop/restart it ───────────────────────────
if [ -f "$ASVC" ]; then
  grep -qx "$SERVICE" "$ASVC" || echo "$SERVICE" >> "$ASVC"
  sudo systemctl restart moonraker 2>/dev/null || true
fi

cat <<MSG

[native] Done. The FilaMind screen native print-control app is installed but NOT yet on the screen.
  Put it on the screen:  FilaMind Flow > Screen Manager > Touch UI > "Use"   (or: sudo systemctl start $SERVICE)
  KlipperScreen stays the boot default until you persist the switch (reboot-recoverable).
  Remove it:             bash deploy/install-native.sh --uninstall
MSG
