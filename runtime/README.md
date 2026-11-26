# Founda Dock Station Runtime

The Android/Termux-hosted execution environment for Founda Dock. The web
dashboard (Vercel) is only a control interface — this runtime owns the shell,
processes, agents and filesystem.

## Layout

```
runtime/
  installer/   install.sh  verify.sh  update.sh  uninstall.sh
  api/         Fastify + TypeScript Station API (src/, tests/)
  scripts/     station-start/stop/status/restart.sh
  config/      example.json
  docs/        TERMUX_SETUP.md  API.md  SECURITY.md  TROUBLESHOOTING.md
```

## Quick start (on the Android device, inside Termux)

```bash
bash runtime/installer/install.sh
~/founda-dock/runtime/station-start.sh
node ~/founda-dock/runtime/api/dist/cli.js pair
```

Then open Founda Dock → Connections and enter the pairing code.

## Development (Linux/macOS)

```bash
cd runtime/api
pnpm install
pnpm test        # 17 tests: auth, pairing, paths, API
pnpm run build
FOUNDA_DOCK_HOME=/tmp/fd node dist/server.js
```

The runtime runs on Linux for development; Android-specific metrics degrade
to explicit `null` where `/proc` is unavailable. **Android integration tests
must be run on a real Termux device** — Linux results do not prove Termux
compatibility.
