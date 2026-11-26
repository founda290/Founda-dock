#!/usr/bin/env bash
# Start the Founda Dock Station runtime.
set -euo pipefail
HOME_DIR="${FOUNDA_DOCK_HOME:-$HOME/founda-dock}"
API="$HOME_DIR/runtime/api"

if [ ! -f "$API/dist/server.js" ]; then
  echo "Station API is not built. Run the installer first." >&2
  exit 1
fi

# Prevent duplicate instances.
if [ -f "$HOME_DIR/data/station.pid" ] && kill -0 "$(cat "$HOME_DIR/data/station.pid")" 2>/dev/null; then
  echo "Station is already running (PID $(cat "$HOME_DIR/data/station.pid"))."
  exit 0
fi

mkdir -p "$HOME_DIR/logs" "$HOME_DIR/data"
cd "$API"
nohup node dist/server.js >>"$HOME_DIR/logs/station.log" 2>&1 &
echo $! > "$HOME_DIR/data/station.pid"
echo "Station started (PID $!). Logs: $HOME_DIR/logs/station.log"
