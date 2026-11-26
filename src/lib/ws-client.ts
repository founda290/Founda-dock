import type { WsEvent } from "./types";
import { WsEventSchema, safeParse } from "./schemas";

// WebSocket client with exponential-backoff reconnect and strict validation.
// Reconnects never create duplicate terminal sessions — session lifecycle is
// owned by the runtime; this client only re-attaches to the event stream.

type Handler = (e: WsEvent) => void;

export class WsClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private retryMs = 1000;
  private closed = false;
  private url: string;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    if (!this.url || this.closed) return;
    try {
      this.socket = new WebSocket(this.url);
    } catch {
      this.schedule();
      return;
    }
    this.socket.onopen = () => { this.retryMs = 1000; };
    this.socket.onmessage = (ev) => {
      try {
        const raw = JSON.parse(String(ev.data));
        const parsed = safeParse(WsEventSchema, raw);
        if (parsed) this.handlers.forEach((h) => h(parsed as WsEvent));
      } catch { /* ignore malformed frames */ }
    };
    this.socket.onclose = () => this.schedule();
    this.socket.onerror = () => this.socket?.close();
  }

  private schedule() {
    if (this.closed) return;
    setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 30000);
  }

  subscribe(h: Handler) { this.handlers.add(h); return () => this.handlers.delete(h); }
  send(msg: unknown) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg)); }
  state(): "connected" | "connecting" | "disconnected" {
    if (!this.socket) return "connecting";
    if (this.socket.readyState === WebSocket.OPEN) return "connected";
    if (this.socket.readyState === WebSocket.CONNECTING) return "connecting";
    return "disconnected";
  }
  close() { this.closed = true; this.socket?.close(); }
}
