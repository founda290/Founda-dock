import type { WebSocket } from "@fastify/websocket";
import { verifySession, type SessionInfo } from "../security/auth.js";
import { captureOutput, sendInput, resizeSession } from "../terminal/sessions.js";

// ---------------------------------------------------------------------------
// WebSocket hub. Browsers cannot set Authorization headers on WS upgrades, so
// authentication happens via a first-message handshake: the client must send
// { type: "auth", token } within 5 seconds. Unauthenticated sockets are closed.
// Events follow the typed envelope { type, ts, payload }.
// ---------------------------------------------------------------------------

export type WsEventType =
  | "terminal.output" | "terminal.status" | "terminal.exit"
  | "station.status" | "station.metrics" | "station.heartbeat"
  | "service.status" | "service.logs" | "workspace.updated"
  | "connection.status" | "runtime.error";

export interface WsEvent {
  type: WsEventType;
  ts: string;
  payload: unknown;
}

const clients = new Set<{ ws: WebSocket; session: SessionInfo | null; sessionId: string | null }>();

export function clientCount(): number {
  return clients.size;
}

export function broadcast(type: WsEventType, payload: unknown): void {
  const msg = JSON.stringify({ type, ts: new Date().toISOString(), payload });
  for (const c of clients) {
    if (c.ws.readyState === 1) c.ws.send(msg);
  }
}

export function handleSocket(ws: WebSocket, maxConnections: number): void {
  if (clients.size >= maxConnections) {
    ws.send(JSON.stringify({ type: "runtime.error", ts: new Date().toISOString(), payload: { code: "CONNECTION_LIMIT", message: "Too many connections" } }));
    ws.close(1013, "connection limit");
    return;
  }
  const entry = { ws, session: null as SessionInfo | null, sessionId: null as string | null };
  clients.add(entry);

  const authTimer = setTimeout(() => {
    if (!entry.session) ws.close(4401, "authentication timeout");
  }, 5000);

  let lastSeen = "";
  let pollTimer: NodeJS.Timeout | null = null;

  ws.on("message", async (raw: Buffer) => {
    let msg: { type?: string; token?: string; data?: string; sessionId?: string; cols?: number; rows?: number };
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (!entry.session) {
      if (msg.type === "auth" && msg.token) {
        const session = verifySession(msg.token);
        if (!session) { ws.close(4401, "invalid token"); return; }
        entry.session = session;
        clearTimeout(authTimer);
        ws.send(JSON.stringify({ type: "connection.status", ts: new Date().toISOString(), payload: { status: "authenticated", label: session.label } }));
      }
      return;
    }

    if (msg.type === "terminal.attach" && msg.sessionId) {
      entry.sessionId = msg.sessionId;
      lastSeen = "";
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        if (!entry.sessionId) return;
        const { output, seen, alive } = await captureOutput(entry.sessionId, lastSeen);
        lastSeen = seen;
        if (output) ws.send(JSON.stringify({ type: "terminal.output", ts: new Date().toISOString(), payload: { sessionId: entry.sessionId, data: output } }));
        if (!alive) {
          ws.send(JSON.stringify({ type: "terminal.exit", ts: new Date().toISOString(), payload: { sessionId: entry.sessionId, exitCode: null } }));
          if (pollTimer) clearInterval(pollTimer);
        }
      }, 250);
    }
    if (msg.type === "terminal.input" && msg.sessionId && typeof msg.data === "string") {
      await sendInput(msg.sessionId, msg.data).catch(() => {});
    }
    if (msg.type === "terminal.resize" && msg.sessionId && msg.cols && msg.rows) {
      await resizeSession(msg.sessionId, msg.cols, msg.rows).catch(() => {});
    }
    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "station.heartbeat", ts: new Date().toISOString(), payload: { ok: true } }));
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimer);
    if (pollTimer) clearInterval(pollTimer);
    clients.delete(entry);
  });
  ws.on("error", () => {
    if (pollTimer) clearInterval(pollTimer);
    clients.delete(entry);
  });
}
