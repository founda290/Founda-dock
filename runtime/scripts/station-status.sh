#!/usr/bin/env bash
# Show Founda Dock Station status.
set -euo pipefail
HOME_DIR="${FOUNDA_DOCK_HOME:-$HOME/founda-dock}"

echo "== Founda Dock Station =="
if [ -f "$HOME_DIR/data/station.pid" ] && kill -0 "$(cat "$HOME_DIR/data/station.pid")" 2>/dev/null; then
  echo "Runtime: RUNNING (PID $(cat "$HOME_DIR/data/station.pid"))"
else
  echo "Runtime: STOPPED"
fi
echo "tmux sessions:"
tmux list-sessions 2>/dev/null || echo "  (none)"
if curl -sf http://127.0.0.1:4310/api/v1/health >/dev/null 2>&1; then
  echo "API: healthy at http://127.0.0.1:4310"
else
  echo "API: unreachable"
fi
