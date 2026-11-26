# Founda Dock

**Code. Create. Automate.**

Founda Dock is the browser control centre for an Android-hosted development Station.
The phone runs the shell, processes and agents through Termux; this web app monitors and
controls them — it is not the execution environment itself.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS 4 · xterm.js · Zustand ·
TanStack Query · Zod · React Hook Form · Lucide icons · pnpm

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 — the app starts in **SIMULATED** mode (clearly labelled)
with sample data, so the full interface works before the Android runtime exists.

## Live mode

Set these environment variables and restart:

```bash
NEXT_PUBLIC_STATION_MODE=real
NEXT_PUBLIC_STATION_API_URL=http://<device-ip>:4310
NEXT_PUBLIC_STATION_WS_URL=ws://<device-ip>:4310/events
```

See [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for the full Station API contract,
WebSocket events and security requirements.

## Routes

`/dashboard` · `/terminal` · `/agents` · `/workspaces` · `/workspaces/[id]` · `/files` ·
`/system` · `/connections` · `/logs` · `/settings` · `/help`

## Architecture

- `src/lib/provider.ts` — `StationProvider` interface (the only seam between UI and transport)
- `src/lib/mock-provider.ts` — `MockStationProvider` (SIMULATED data)
- `src/lib/real-provider.ts` — `RealStationProvider` (HTTP + WebSocket, Zod-validated)
- `src/lib/schemas.ts` — runtime validation for every API/WS payload
- `src/lib/store.ts` — Zustand UI state (sidebar, toasts, confirmations)
