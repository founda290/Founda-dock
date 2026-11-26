# Founda Dock Station — Troubleshooting

## "This installer must run inside Termux"
Install Termux from F-Droid (not the Play Store), then re-run.

## Node.js not found / too old
```bash
pkg install nodejs-lts
node -v   # must be >= 20
```

## API unreachable from browser
1. Check the Station is running: `~/founda-dock/runtime/station-status.sh`
2. Check the health endpoint on the device: `curl http://127.0.0.1:4310/api/v1/health`
3. For LAN access, set `"host": "0.0.0.0"` in `~/founda-dock/config/config.json` and restart.
4. Check Android firewall / VPN apps that may block LAN traffic.

## Pairing code rejected
- Codes expire after 5 minutes and are single-use. Generate a fresh one:
  `node ~/founda-dock/runtime/api/dist/cli.js pair`
- Too many attempts trigger a 10-minute rate limit. Wait, then retry.

## Terminal sessions missing
Sessions live in tmux. Check `tmux list-sessions`. If tmux is not installed:
`pkg install tmux`, then restart the Station.

## OpenCode / OpenClaw show "unknown"
The binary is not installed or not on PATH. Install it, then check
`command -v opencode` / `command -v openclaw` in Termux. The runtime reports
UNAVAILABLE truthfully — it never fabricates a running state.

## Metrics show null
Some metrics (CPU %) need two samples; others depend on `/proc` availability.
Null means "unavailable on this device", never zero.

## Station died after reboot
Install Termux:Boot and symlink `station-start.sh` into `~/.termux/boot/`.
Note: Android force-stop still kills Termux — see TERMUX_SETUP.md.

## Logs
`~/founda-dock/logs/station.log` — the runtime never writes secrets to logs.
