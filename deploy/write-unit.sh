#!/usr/bin/env bash
# Standalone systemd unit-writer for the FilaMind screen touch app.
#
# FilaMind Flow ships a single-source touch-UI unit-writer (scripts/install.sh kiosk) that the whole
# suite prefers when Flow is installed. This bundled writer is the STANDALONE fallback so the screen
# installs and runs on a printer host that does NOT have FilaMind Flow. It produces the same
# fullscreen bare-X (xinit) unit, with the touch-UI Conflicts= list so only one GUI owns the panel.
#
#   write-unit.sh --bin /usr/bin/filamind-screen <USER> "" <SERVICE>
#
# Args mirror Flow's `kiosk` subcommand so install-native.sh can call either with one interface:
#   --bin BIN   the app binary to launch
#   USER        the login user that owns the X session
#   URL         a browser URL for a webview kiosk (EMPTY for the native app - launched directly)
#   SERVICE     the systemd unit base name (default filamind-screen-kiosk)
#
# Must run as root (writes /etc/systemd/system + usermod). set -e so a failed write is never silent.
set -euo pipefail

BIN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --bin) BIN="${2:-}"; shift 2 ;;
    *) break ;;
  esac
done
USER_NAME="${1:?write-unit: USER argument required}"
URL="${2:-}"
SERVICE="${3:-filamind-screen-kiosk}"

[ -n "$BIN" ] || { echo "[write-unit] --bin is required" >&2; exit 2; }
[ "$(id -u)" = "0" ] || { echo "[write-unit] must run as root" >&2; exit 2; }

# Bare X needs xinit + an X server. Hosts that ran KlipperScreen already have them; refuse clearly
# rather than write a unit that would crash-loop on a host with no X stack.
if ! command -v xinit >/dev/null 2>&1; then
  echo "[write-unit] 'xinit' not found - this writer targets the bare-X (xinit) display stack used" >&2
  echo "             by KlipperScreen hosts. Install xserver-xorg + xinit, or use FilaMind Flow's" >&2
  echo "             writer (it also handles cage/Wayland)." >&2
  exit 1
fi

UID_N="$(id -u "$USER_NAME" 2>/dev/null || echo 1000)"

# Group access for a bare-X session (best-effort; missing groups are simply skipped).
for g in video render input tty seat; do
  getent group "$g" >/dev/null 2>&1 && usermod -aG "$g" "$USER_NAME" 2>/dev/null || true
done

# The native app launches directly under xinit; a URL (webview kiosk) is not the native path but is
# accepted for interface parity - launch it via the same binary if ever given one.
LAUNCH="$BIN"
[ -n "$URL" ] && LAUNCH="$BIN $URL"

UNIT="/etc/systemd/system/${SERVICE}.service"
cat > "$UNIT" <<EOF
# Managed by FilaMind screen (deploy/write-unit.sh) - standalone, no FilaMind Flow required.
# Fullscreen native touch app (bare X via xinit). Conflicts with the other touch UIs so starting
# one stops the others.
[Unit]
Description=FilaMind screen (native touch UI): ${SERVICE}
Conflicts=KlipperScreen.service guppyscreen.service filamind-kiosk.service
After=multi-user.target systemd-user-sessions.target network-online.target
Wants=network-online.target
StartLimitIntervalSec=120
StartLimitBurst=5

[Service]
Type=simple
User=${USER_NAME}
PAMName=login
TTYPath=/dev/tty7
StandardInput=tty-fail
StandardOutput=journal
StandardError=journal
Environment=XDG_RUNTIME_DIR=/run/user/${UID_N}
Environment=WEBKIT_DISABLE_COMPOSITING_MODE=1
OOMScoreAdjust=200
OOMPolicy=kill
ExecStart=/usr/bin/xinit ${LAUNCH} -- :0 vt7 -nocursor
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
EOF

systemctl daemon-reload 2>/dev/null || true
echo "[write-unit] wrote $UNIT (service: ${SERVICE})"
