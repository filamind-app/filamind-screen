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
  native)
    # Native touch app (the .deb) — bypasses the nginx/clone path entirely.
    shift
    SELF_N="${BASH_SOURCE[0]:-}"
    if [ -n "$SELF_N" ] && [ -f "$SELF_N" ]; then
      APP="$(cd "$(dirname "$SELF_N")/.." && pwd)"
    fi
    exec bash "$APP/deploy/install-native.sh" "$@"
    ;;
esac

info() { printf '\n\033[1;33m==>\033[0m %s\n' "$*"; }

# If this script is on disk (run from a clone), use that clone; otherwise (curl | bash, or the Setup
# widget's `bash -c`) clone it - and if a clone already EXISTS, refresh it to current main first.
# Reusing a stale pre-existing clone would run an outdated deploy/install.sh (the old one had a
# `require_root` gate that prints "Run with sudo." and exits), so install kept failing until the host
# was re-cloned by hand. Hard-reset (not pull --ff-only) so a diverged/dirty checkout still updates.
SELF="${BASH_SOURCE[0]:-}"
if [ -n "$SELF" ] && [ -f "$SELF" ]; then
  APP="$(cd "$(dirname "$SELF")/.." && pwd)"
  if [ "$CMD" = update ]; then
    info "Updating FilaMind screen"
    git -C "$APP" pull --ff-only
  fi
else
  command -v git >/dev/null || {
    echo "git not found; install git first." >&2
    exit 1
  }
  if [ ! -d "$APP/.git" ]; then
    info "Cloning FilaMind screen -> $APP"
    git clone --depth 1 "$REPO" "$APP"
  else
    info "Refreshing FilaMind screen -> $APP"
    git -C "$APP" fetch --depth 1 origin main && git -C "$APP" reset --hard origin/main
  fi
fi

# 'update' is handled above (refresh); everything past here is the normal install.
[ "$CMD" = update ] && CMD=install

# When invoked via `curl | bash`, stdin is the pipe (not a terminal), so the sudo calls below can't
# prompt for a password. Reconnect the controlling terminal when one is actually attached. Testing
# `[ -e /dev/tty ]` is not enough: in a service context (no controlling terminal) the device node
# still exists but opening it fails, and a bare `exec </dev/tty` would abort the whole script. Probe
# that it opens first; if it does not (a headless run, e.g. from the Setup widget) fall through and
# let sudo print its own clear error instead of dying on a cryptic /dev/tty failure.
if [ ! -t 0 ] && (exec </dev/tty) 2>/dev/null; then exec </dev/tty; fi

if [ "$CMD" = uninstall ]; then
  info "Removing FilaMind screen"
  # If the native touch app was installed, remove it first (restores KlipperScreen, drops the unit +
  # the Moonraker registration) so the full uninstall leaves no orphan display-owner unit.
  if [ -f /etc/systemd/system/filamind-screen-kiosk.service ]; then
    bash "$APP/deploy/install-native.sh" --uninstall 2>/dev/null || true
  fi
  # deploy/install.sh runs as this user and elevates only the narrow steps (cp/systemctl) itself,
  # so no full-root `sudo bash` - this lets the FilaMind flow Setup service install it passwordless.
  bash "$APP/deploy/install.sh" --uninstall
  exit 0
fi

info "Installing FilaMind screen (serving the prebuilt touch UI via nginx)"
bash "$APP/deploy/install.sh" "$@"
