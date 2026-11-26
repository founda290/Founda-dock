#!/usr/bin/env bash
# Restart the Founda Dock Station runtime.
set -euo pipefail
HOME_DIR="${FOUNDA_DOCK_HOME:-$HOME/founda-dock}"
"$HOME_DIR/runtime/station-stop.sh" || true
sleep 1
"$HOME_DIR/runtime/station-start.sh"
