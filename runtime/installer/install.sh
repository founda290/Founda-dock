#!/usr/bin/env bash
# Founda Dock Station runtime installer for Termux.
# Safe to run more than once: existing config is never overwritten without
# confirmation, and workspaces are never deleted.
set -euo pipefail

HOME_DIR="${FOUNDA_DOCK_HOME:-$HOME/founda-dock}"
RUNTIME_SRC="$(cd "$(dirname "$0")/.." && pwd)"

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# 1. Must run inside Termux.
if [ -z "${TERMUX_VERSION:-}" ] && [ ! -d "$HOME/.termux" ]; then
  fail "This installer must run inside Termux (https://f-droid.org/packages/com.termux/)."
fi
say "Termux detected."

# 2. Architecture.
ARCH="$(uname -m)"
say "Architecture: $ARCH"
case "$ARCH" in
  aarch64|arm64|armv8l|armv7l|arm|x86_64|amd64) ;;
  *) fail "Unsupported architecture: $ARCH" ;;
esac

# 3. Node.js compatibility.
command -v node >/dev/null 2>&1 || fail "Node.js not found. Install it with: pkg install nodejs-lts"
NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js >= 20 required (found $(node -v))."
say "Node.js $(node -v) OK."

# 4. Required packages (install only what is missing).
for pkg in git tmux openssh python curl wget jq procps coreutils; do
  if ! command -v "$pkg" >/dev/null 2>&1; then
    say "Installing $pkg..."
    pkg install -y "$pkg" || fail "Failed to install $pkg"
  fi
done
command -v tmux >/dev/null 2>&1 || fail "tmux is required for the terminal engine."

# 5. Directory layout.
say "Creating $HOME_DIR layout..."
mkdir -p "$HOME_DIR/projects" "$HOME_DIR/runtime" "$HOME_DIR/config" "$HOME_DIR/logs" "$HOME_DIR/data" "$HOME_DIR/backups"

# 6. Install the Station API.
say "Installing Station API..."
API_DST="$HOME_DIR/runtime/api"
mkdir -p "$API_DST"
cp -r "$RUNTIME_SRC/api/package.json" "$RUNTIME_SRC/api/tsconfig.json" "$API_DST/"
cp -r "$RUNTIME_SRC/api/src" "$API_DST/"
cd "$API_DST"
npm install --omit=dev
npm run build

# 7. Initial configuration (never overwrite without confirmation).
CONFIG="$HOME_DIR/config/config.json"
if [ -f "$CONFIG" ]; then
  say "Existing config found at $CONFIG — leaving it untouched."
else
  say "Generating initial config..."
  node -e "
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const home = process.env.FOUNDA_DOCK_HOME || path.join(os.homedir(), 'founda-dock');
    const cfg = {
      stationId: 'station-' + Math.random().toString(36).slice(2, 10),
      stationName: 'Founda Dock Station',
      host: '127.0.0.1',
      port: 4310,
      workspaceRoots: [path.join(home, 'projects')],
      defaultShell: 'bash',
      sessionTtlHours: 168,
      pairingTtlSeconds: 300,
      pairingMaxAttempts: 5,
      pairingWindowSeconds: 600,
      metricsIntervalMs: 5000,
      maxWsConnections: 20,
      opencodeBin: 'opencode',
      openclawBin: 'openclaw'
    };
    fs.mkdirSync(path.join(home, 'config'), { recursive: true });
    fs.writeFileSync(path.join(home, 'config', 'config.json'), JSON.stringify(cfg, null, 2), { mode: 0o600 });
  "
fi

# 8. Management scripts.
say "Installing management scripts..."
for s in station-start station-stop station-status station-restart; do
  cp "$RUNTIME_SRC/scripts/$s.sh" "$HOME_DIR/runtime/$s.sh"
  chmod +x "$HOME_DIR/runtime/$s.sh"
done
cp "$API_DST/dist/cli.js" "$HOME_DIR/runtime/cli.js" 2>/dev/null || true

# 9. Verify.
say "Verifying installation..."
"$HOME_DIR/runtime/station-status.sh" || true

cat <<EOF

Installation complete.

Next steps:
  1. Start the Station:   $HOME_DIR/runtime/station-start.sh
  2. Generate a pairing code:  node $HOME_DIR/runtime/api/dist/cli.js pair
  3. Open Founda Dock in your browser and pair with the code.
  4. Local access works on your Wi-Fi network without Cloudflare.

Docs: $RUNTIME_SRC/docs/TERMUX_SETUP.md
EOF
