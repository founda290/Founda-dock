#!/usr/bin/env bash
# Uninstall the Station runtime. Workspaces are preserved unless --purge is given.
set -euo pipefail
HOME_DIR="${FOUNDA_DOCK_HOME:-$HOME/founda-dock}"

echo "Stopping Station..."
"$HOME_DIR/runtime/station-stop.sh" 2>/dev/null || true

rm -rf "$HOME_DIR/runtime" "$HOME_DIR/config" "$HOME_DIR/data" "$HOME_DIR/logs"
echo "Runtime removed. Workspaces in $HOME_DIR/projects were preserved."

if [ "${1:-}" = "--purge" ]; then
  rm -rf "$HOME_DIR"
  echo "Purged $HOME_DIR entirely."
fi
