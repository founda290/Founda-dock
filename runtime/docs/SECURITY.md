# Founda Dock Station — Security Model

## Principles

1. **The runtime authenticates independently.** Vercel serving the frontend
   grants no access. Every API request and WebSocket connection must present a
   valid session token issued by the runtime.
2. **Least privilege.** Each session carries an explicit permission set
   (`metrics:read`, `files:read`, `files:write`, `terminal:create`,
   `terminal:exec`, `agents:manage`, `connections:manage`, `destructive`).
   The runtime enforces permissions per route.
3. **Secrets are write-only.** Pairing codes and session tokens are stored only
   as SHA-256 hashes. Agent API keys are accepted on save and never returned
   or logged.
4. **No credentials in URLs or localStorage.** Browser tokens live in memory
   only; WebSocket auth uses a first-message handshake.
5. **Filesystem boundaries.** All browser-supplied paths are canonicalised,
   symlink-resolved, and checked against permitted workspace roots. Config,
   auth data, backups and logs are always protected.

## Pairing

- Codes are 6 digits, single-use, expire after 5 minutes (configurable).
- Rate limited: 5 attempts per 10 minutes per IP (configurable).
- Successful pairing issues a 32-byte random session token with an expiry
  (default 7 days) and a permission set.
- Sessions can be revoked from the device (`node dist/cli.js revoke <id>`) or
  from the browser (Connections page).

## Network exposure

- Default bind: `127.0.0.1` (loopback only).
- LAN mode (`0.0.0.0`) requires explicit config and still requires pairing.
- Remote access via Cloudflare Tunnel is opt-in. Never expose raw shell ports,
  the OpenCode management endpoint, or the OpenClaw gateway without the
  Station's own authentication layer in front.

## Credential storage

- `~/founda-dock/data/auth.json` — session hashes, mode `0600`.
- `~/founda-dock/config/config.json` — non-secret config, mode `0600`.
- No plaintext secrets are written to logs.

## Known limitations

- Termux has no OS keychain equivalent; file permissions are the protection.
- The runtime cannot prevent Android from killing it after force-stop.
- Cloudflare Tunnel on Termux depends on the `cloudflared` binary for your
  architecture; if unavailable, use LAN access or an alternative authenticated
  relay. The tunnel is never required for local use.
