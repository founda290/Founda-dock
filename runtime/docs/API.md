# Founda Dock Station — API Reference

Base URL: `http://<device>:4310/api/v1` (default bind `127.0.0.1:4310`).

All endpoints except `GET /health` and `POST /connections/pair` require
`Authorization: Bearer <session-token>` (or the `fd_session` cookie).

## Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/health` | public | Liveness probe |
| GET | `/station` | metrics:read | Station + device info, capabilities |
| GET | `/system` | metrics:read | Real CPU/mem/disk/uptime (null when unavailable) |
| GET | `/services` | metrics:read | Service states (truthful, never assumed) |
| POST | `/services/:service/start` | agents:manage | Start a managed service |
| POST | `/services/:service/stop` | agents:manage | Stop gracefully |
| POST | `/services/:service/restart` | agents:manage | Restart |
| GET | `/services/:service/logs` | metrics:read | Captured stdout/stderr tail |
| GET | `/terminal/sessions` | terminal:create | List tmux sessions |
| POST | `/terminal/sessions` | terminal:create | Create session `{ cwd? }` |
| GET | `/terminal/sessions/:id` | terminal:create | Session detail |
| DELETE | `/terminal/sessions/:id` | destructive | Kill session |
| GET | `/workspaces` | workspaces:read | List workspaces with git info |
| POST | `/workspaces` | files:write | Create workspace `{ name }` |
| GET | `/workspaces/:id` | workspaces:read | Workspace detail + tree |
| POST | `/workspaces/:id/git/:action` | files:write | `pull` / `push` / `status` |
| GET | `/files?path=` | files:read | Directory listing (boundary-checked) |
| GET | `/files/content?path=` | files:read | Text preview (256 KB cap) |
| POST | `/files/folder` | files:write | Create folder |
| POST | `/files/rename` | files:write | Rename |
| POST | `/files/delete` | destructive | Delete |
| GET | `/logs` | metrics:read | Station logs (filterable) |
| GET | `/connections` | connections:manage | Paired sessions |
| POST | `/connections/pair` | public (rate-limited) | Exchange code → session token |
| DELETE | `/connections/:id` | connections:manage | Revoke session |
| GET | `/agents/:agent/config` | agents:manage | Agent config (no secrets) |
| POST | `/agents/:agent/config` | agents:manage | Save config (secret write-only) |
| GET | `/settings` | metrics:read | Settings |
| POST | `/settings` | connections:manage | Save settings |
| POST | `/station/restart` | destructive | Restart runtime process |

Errors: `{ error: { code, message } }` with correct HTTP status
(401 unauthenticated, 403 forbidden, 404 not found, 400 bad path, 429 rate limited).

## WebSocket (`/api/v1/events`)

First message must be `{ "type": "auth", "token": "..." }` within 5 s.
Then: `{ "type": "terminal.attach", "sessionId": "..." }` to stream output,
`terminal.input` / `terminal.resize` for interaction, `ping` for heartbeat.

Server events: `terminal.output`, `terminal.status`, `terminal.exit`,
`station.status`, `station.metrics`, `station.heartbeat`, `service.status`,
`service.logs`, `workspace.updated`, `connection.status`, `runtime.error`.
