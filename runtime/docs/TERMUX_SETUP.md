# Founda Dock Station — Termux Setup

## Supported environments

| Item | Supported |
|---|---|
| Android | 10+ (Termux requires Android 7+; 10+ recommended) |
| Architectures | `aarch64` / `arm64` (most phones), `armv7l`, `x86_64` |
| Node.js | 20+ (`nodejs-lts` in Termux) |
| Termux | Latest from F-Droid (not the Play Store build) |

## Install

1. Install **Termux** from [F-Droid](https://f-droid.org/packages/com.termux/).
2. Open Termux and update packages:
   ```bash
   pkg update -y
   ```
3. Copy this repository to the phone (e.g. via `git clone`, or transfer the `runtime/` folder).
4. Run the installer:
   ```bash
   bash runtime/installer/install.sh
   ```
   The installer is idempotent — safe to run more than once. It never overwrites
   existing config without confirmation and never deletes workspaces.

## Start / stop / status

```bash
~/founda-dock/runtime/station-start.sh
~/founda-dock/runtime/station-stop.sh
~/founda-dock/runtime/station-status.sh
~/founda-dock/runtime/station-restart.sh
```

Terminal sessions live in **tmux** and survive both browser disconnects and
Station restarts.

## Pairing

1. Start the Station.
2. Generate a pairing code on the device:
   ```bash
   node ~/founda-dock/runtime/api/dist/cli.js pair
   ```
3. Open Founda Dock in your browser → **Connections** → enter the 6-digit code.
4. The browser receives a session token (kept in memory only). Pairing codes are
   single-use and expire after 5 minutes.

## Local connectivity

By default the API binds `127.0.0.1` (loopback only). To access it from a
browser on the same Wi-Fi network, set `"host": "0.0.0.0"` in
`~/founda-dock/config/config.json` and restart. Every request still requires a
paired session token — the listener is never unauthenticated.

## OpenCode / OpenClaw

Install each tool separately (they are optional). The runtime detects the
binaries (`opencode`, `openclaw`) and reports them as **UNAVAILABLE** when
missing — it never pretends they are running. Start/stop them from the
Founda Dock **Agents** page.

## Remote access (optional)

Cloudflare Tunnel (`cloudflared`) can expose the Station API over HTTPS when
installed on the device. This is a separate, opt-in module — local access
works without it. See `SECURITY.md` for the security model. **Do not expose
the API publicly without the pairing/session authentication enabled** (it is
always on).

## Background execution

- `termux-wake-lock` keeps the device awake while the Station runs; it
  consumes battery. Use it only while actively developing.
- **Termux:Boot** can start the Station after a reboot (install the Termux:Boot
  add-on, then symlink `station-start.sh` into `~/.termux/boot/`).
- Android may still kill Termux after force-stop or under memory pressure —
  persistence after force-stop is **not guaranteed**. The future native Android
  app will provide a foreground service for reliable background operation.

## Uninstall

```bash
bash runtime/installer/uninstall.sh        # keeps workspaces
bash runtime/installer/uninstall.sh --purge # removes everything
```
