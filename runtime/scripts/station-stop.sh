#!/usr/bin/env bash
# Stop the Founda Dock Station runtime (tmux sessions are preserved).
set -euo pipefail
HOME_DIR="${FOUNDA_DOCK_HOME:-$HOME/founda-dock}"

if [ -f "$HOME_DIR/data/station.pid" ]; then
  PID="$(cat "$HOME_DIR/data/station.pid")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Station stopped (PID $PID). Terminal sessions remain in tmux."
  else
    echo "Station was not running."
  fi
  rm -f "$HOME_DIR/data/station.pid"
else
  echo "Station is not running."
fi
