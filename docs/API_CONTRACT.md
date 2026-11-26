# Founda Dock — Station API Contract

Founda Dock is a control interface. The Android device (Termux) is the execution host and
exposes an authenticated HTTP API + WebSocket event channel. The web app is integration-ready:
until the runtime exists it runs in **SIMULATED** mode via `MockStationProvider`.

## Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_STATION_MODE` | `mock` (default) or `real` |
| `NEXT_PUBLIC_STATION_API_URL` | Base URL of the Station API, e.g. `http://192.168.1.42:4310` |
| `NEXT_PUBLIC_STATION_WS_URL` | WebSocket event URL, e.g. `ws://192.168.1.42:4310/events` |

## HTTP endpoints (base: `/api/v1`)

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ ok: true }` |
| GET | `/station` | `StationInfo` |
| GET | `/system` | `SystemMetrics` |
| GET | `/services` | `ServiceInfo[]` |
| POST | `/services/:service/start` | `ServiceInfo` |
| POST | `/services/:service/stop` | `ServiceInfo` |
| POST | `/services/:service/restart` | `ServiceInfo` |
| POST | `/station/start` · `/stop` · `/restart` | `StationInfo` |
| GET | `/terminal/sessions` | `TerminalSession[]` |
| POST | `/terminal/sessions` `{ cwd? }` | `TerminalSession` |
| DELETE | `/terminal/sessions/:id` | `204` |
| GET | `/workspaces` | `Workspace[]` |
| POST | `/workspaces` `{ name }` | `Workspace` |
| GET | `/workspaces/:id` | `WorkspaceDetail` |
| POST | `/workspaces/:id/rename` `{ name }` | `Workspace` |
| DELETE | `/workspaces/:id` | `204` |
| POST | `/workspaces/:id/git/pull` · `/push` · `/status` | `Workspace` |
| GET | `/files?path=` | `FileEntry[]` |
| GET | `/files/content?path=` | `{ content, truncated }` |
| POST | `/files/folder` `{ path, name }` | `FileEntry` |
| POST | `/files/rename` `{ path, newName }` | `FileEntry` |
| POST | `/files/delete` `{ path }` | `204` |
| POST | `/files/upload` (multipart) | `FileEntry` |
| GET | `/logs?category=&severity=&q=` | `LogEntry[]` |
| GET | `/activity` | `ActivityEvent[]` |
| GET | `/connections` | `ConnectionInfo[]` |
| POST | `/connections/pair` `{ code }` | `ConnectionInfo` |
| DELETE | `/connections/:id` | `204` |
| POST | `/connections/rotate` | `204` |
| POST | `/connections/remote-access` `{ enabled }` | `204` |
| GET | `/agents/:agent/config` | `AgentConfig` (no secrets) |
| POST | `/agents/:agent/config` `{ ..., secret? }` | `AgentConfig` |
| GET | `/settings` | `StationSettings` |
| POST | `/settings` | `StationSettings` |

Types are defined in `src/lib/types.ts`; runtime validation lives in `src/lib/schemas.ts` (Zod).

## WebSocket events

Envelope: `{ type, ts, payload }`. Types:

`terminal.output`, `terminal.status`, `terminal.exit`, `station.status`,
`station.metrics`, `service.status`, `service.logs`, `workspace.updated`,
`connection.status`, `runtime.error`.

The client reconnects with exponential backoff (1s → 30s) and only re-attaches to the
event stream — it never creates duplicate terminal sessions. Terminal I/O uses
`terminal.input` / `terminal.resize` messages on the same channel.

## Security requirements for the runtime

- Authenticate every HTTP and WebSocket request (session cookie or short-lived token).
- Never expose an unauthenticated shell, or OpenCode/OpenClaw gateway ports publicly.
- Enforce workspace filesystem boundaries; reject paths outside permitted directories.
- Secrets are write-only: accept on save, never return them.
- Rate-limit sensitive endpoints (pairing, credential rotation, session creation).
- Never include credentials or tokens in logs or error messages.
