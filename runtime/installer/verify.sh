#!/usr/bin/env bash
# Verify a Founda Dock Station installation.
set -euo pipefail
HOME_DIR="${FOUNDA_DOCK_HOME:-$HOME/founda-dock}"
API="$HOME_DIR/runtime/api"

echo "== Founda Dock Station verification =="
echo "Home: $HOME_DIR"
echo "Node: $(node -v 2>/dev/null || echo MISSING)"
echo "tmux: $(tmux -V 2>/dev/null || echo MISSING)"
echo "git:  $(git --version 2>/dev/null || echo MISSING)"
echo "opencode: $(command -v opencode 2>/dev/null || echo 'not installed (optional)')"
echo "openclaw: $(command -v openclaw 2>/dev/null || echo 'not installed (optional)')"
echo "cloudflared: $(command -v cloudflared 2>/dev/null || echo 'not installed (optional)')"
echo "Config: $([ -f "$HOME_DIR/config/config.json" ] && echo present || echo MISSING)"
echo "API build: $([ -f "$API/dist/server.js" ] && echo present || echo MISSING)"

if curl -sf http://127.0.0.1:4310/api/v1/health >/dev/null 2>&1; then
  echo "API health: OK (http://127.0.0.1:4310)"
else
  echo "API health: NOT RUNNING (start with $HOME_DIR/runtime/station-start.sh)"
fi
