#!/usr/bin/env bash
# Update the Station runtime. Never deletes workspaces or overwrites config.
set -euo pipefail
HOME_DIR="${FOUNDA_DOCK_HOME:-$HOME/founda-dock}"
API="$HOME_DIR/runtime/api"

echo "==> Backing up config..."
mkdir -p "$HOME_DIR/backups"
cp "$HOME_DIR/config/config.json" "$HOME_DIR/backups/config-$(date +%Y%m%d-%H%M%S).json" 2>/dev/null || true

echo "==> Stopping Station..."
"$HOME_DIR/runtime/station-stop.sh" || true

echo "==> Rebuilding API..."
cd "$API"
npm install --omit=dev
npm run build

echo "==> Restarting Station..."
"$HOME_DIR/runtime/station-start.sh"
echo "Update complete. Workspaces and config were preserved."
