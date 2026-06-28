#!/usr/bin/env bash
# FilaMind screen - serve the touch UI on the printer host (for a browser/kiosk test).
#
# Installs an nginx site that serves the built touch SPA AND reverse-proxies Moonraker on the SAME
# origin (no CORS, app auto-resolves ws://<host>:<port>/websocket). This is the quickest way to test
# the touch UI on the printer's display in a browser; the packaged Tauri kiosk app is the eventual
# production path (needs a Rust toolchain - see DEPLOY.md).
#
# The touch UI ships pre-built in frontend/dist, so no Node is needed on the printer; the
# build-on-host path below is only a fallback if the bundle is ever missing.
#
# Runs as your NORMAL user and uses `sudo` only for the specific privileged steps (place the nginx
# site, reload nginx) - exactly cp/chmod/systemctl. So it works both interactively (sudo prompts
# once) and unattended from the FilaMind flow Setup service, which has passwordless sudo for
# precisely those commands - no full-root `sudo bash`, no tee/ln/nginx-binary needed.
#   bash deploy/install.sh [--port 8088] [--moonraker 127.0.0.1:7125]
#   bash deploy/install.sh --uninstall
set -euo pipefail

PORT=8088
MOONRAKER=127.0.0.1:7125
ACTION=install

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --moonraker) MOONRAKER="$2"; shift 2 ;;
    --uninstall) ACTION=uninstall; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$APP_DIR/frontend/dist"
SITE_AVAILABLE=/etc/nginx/sites-available/filamind-screen
SITE_ENABLED=/etc/nginx/sites-enabled/filamind-screen

if [ "$ACTION" = uninstall ]; then
  sudo rm -f "$SITE_ENABLED" "$SITE_AVAILABLE"
  sudo systemctl reload nginx || true
  echo "FilaMind screen nginx site removed."
  exit 0
fi

if [ ! -f "$DIST/index.html" ]; then
  echo "No build found - building the frontend (needs Node 22 + npm)…"
  command -v npm >/dev/null || { echo "npm not found; install Node 22 or ship a prebuilt frontend/dist." >&2; exit 1; }
  ( cd "$APP_DIR/frontend" && npm ci && npm run build )
fi

# Render the site to a temp file AS THE USER, then place it with narrow sudo (cp). We write a real
# file into sites-enabled too (nginx includes sites-enabled/*), which avoids needing `ln`.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP" <<NGINX
server {
    listen $PORT;
    server_name _;
    root $DIST;

    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location / { try_files \$uri \$uri/ /index.html; }

    # Same-origin reverse proxy to Moonraker (REST + WebSocket) - no CORS needed.
    location ~ ^/(server|printer|access|machine) {
        proxy_pass http://$MOONRAKER;
        proxy_set_header Host \$host;
    }
    location /websocket {
        proxy_pass http://$MOONRAKER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }
}
NGINX

echo "Installing nginx site → $SITE_AVAILABLE (port $PORT, Moonraker $MOONRAKER)…"
sudo cp "$TMP" "$SITE_AVAILABLE"
sudo cp "$TMP" "$SITE_ENABLED"
# Let nginx (www-data) traverse into the user's home to reach the dist (no-op if already o+x).
sudo chmod o+x "$HOME" 2>/dev/null || true
# `systemctl reload` re-tests the config and keeps the running one if the new file is bad.
sudo systemctl reload nginx
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "Done. Open FilaMind screen at:  http://${IP:-<printer-ip>}:$PORT/"
echo ""
echo "To run it on the printer's own display, pick \"FilaMind screen\" in FilaMind flow's"
echo "Screen Manager."
