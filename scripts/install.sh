#!/usr/bin/env bash
# FilaMind screen - one-line installer for a Klipper / Moonraker host.
#
# Install (run as your normal printer user; it calls sudo where needed):
#   curl -fsSL https://raw.githubusercontent.com/filamind-app/filamind-screen/main/scripts/install.sh | bash
#
# Uninstall:
#   curl -fsSL https://raw.githubusercontent.com/filamind-app/filamind-screen/main/scripts/install.sh | bash -s -- uninstall
#
# From a clone (e.g. ~/filamind-screen):
#   bash scripts/install.sh [install|uninstall|update] [--port N] [--moonraker host:port]
#
# The touch UI ships pre-built in frontend/dist, so NO Node is needed on the printer: this clones
# the repo (or updates it) and points nginx at the committed bundle with a same-origin Moonraker
# proxy. Open it full-screen on the printer's display with: chromium-browser --kiosk http://localhost:8088/
# Re-runnable.
set -euo pipefail

REPO="${FILAMIND_SCREEN_REPO:-https://github.com/filamind-app/filamind-screen.git}"
APP="${FILAMIND_SCREEN_DIR:-$HOME/filamind-screen}"

CMD="install"
case "${1:-}" in
  install | uninstall | update)
    CMD="$1"
    shift
    ;;
esac

info() { printf '\n\033[1;33m==>\033[0m %s\n' "$*"; }

# If this script is on disk (run from a clone), use that clone; otherwise (curl | bash) clone it.
SELF="${BASH_SOURCE[0]:-}"
if [ -n "$SELF" ] && [ -f "$SELF" ]; then
  APP="$(cd "$(dirname "$SELF")/.." && pwd)"
elif [ ! -d "$APP/.git" ]; then
  info "Cloning FilaMind screen -> $APP"
  command -v git >/dev/null || {
    echo "git not found; install git first." >&2
    exit 1
  }
  git clone --depth 1 "$REPO" "$APP"
fi

if [ "$CMD" = update ]; then
  info "Updating FilaMind screen"
  git -C "$APP" pull --ff-only
  CMD=install
fi

# When invoked via `curl | bash`, stdin is the pipe (not a terminal), so the sudo calls below can't
# prompt for a password. Reconnect the controlling terminal if there is one (a no-op for the
# download-then-run form, where stdin is already a tty).
if [ ! -t 0 ] && [ -e /dev/tty ]; then exec </dev/tty; fi

if [ "$CMD" = uninstall ]; then
  info "Removing FilaMind screen"
  sudo bash "$APP/deploy/install.sh" --uninstall
  exit 0
fi

info "Installing FilaMind screen (serving the prebuilt touch UI via nginx)"
sudo bash "$APP/deploy/install.sh" "$@"
