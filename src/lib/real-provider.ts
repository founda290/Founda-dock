import type {
  ActivityEvent, AgentConfig, ConnectionInfo, FileEntry, LogCategory, LogEntry,
  LogSeverity, ServiceId, ServiceInfo, StationInfo, StationSettings, SystemMetrics,
  TerminalSession, Workspace, WorkspaceDetail, WsEvent,
} from "./types";
import type { StationProvider } from "./provider";
import { WsClient } from "./ws-client";

// ---------------------------------------------------------------------------
// RealStationProvider — talks to the Android runtime over its authenticated
// HTTP API (NEXT_PUBLIC_STATION_API_URL) and WebSocket event channel.
// Every response is validated with Zod before it reaches the UI.
// If the runtime is unreachable, methods reject with a clear error and the
// UI shows the offline/connection screen — it never fabricates success.
// ---------------------------------------------------------------------------

const API = process.env.NEXT_PUBLIC_STATION_API_URL ?? "";
const WS = process.env.NEXT_PUBLIC_STATION_WS_URL ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API) throw new Error("Real Station API URL is not configured (NEXT_PUBLIC_STATION_API_URL)");
  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Station API error ${res.status} on ${path}`);
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown): Promise<T> =>
  req<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export class RealStationProvider implements StationProvider {
  readonly mode = "real" as const;
  readonly label = "LIVE";
  private ws = new WsClient(WS);

  getStation() { return req<StationInfo>("/station"); }
  getSystem() { return req<SystemMetrics>("/system"); }
  getServices() { return req<ServiceInfo[]>("/services"); }
  startService(id: ServiceId) { return post<ServiceInfo>(`/services/${id}/start`); }
  stopService(id: ServiceId) { return post<ServiceInfo>(`/services/${id}/stop`); }
  restartService(id: ServiceId) { return post<ServiceInfo>(`/services/${id}/restart`); }
  startStation() { return post<StationInfo>("/station/start"); }
  stopStation() { return post<StationInfo>("/station/stop"); }
  restartStation() { return post<StationInfo>("/station/restart"); }

  listSessions() { return req<TerminalSession[]>("/terminal/sessions"); }
  createSession(cwd?: string) { return post<TerminalSession>("/terminal/sessions", { cwd }); }
  deleteSession(id: string) { return req<void>(`/terminal/sessions/${id}`, { method: "DELETE" }); }
  terminalSocketUrl(sessionId: string) { return `${WS}/terminal/${sessionId}`; }
  sendTerminalInput(sessionId: string, data: string) { this.ws.send({ type: "terminal.input", sessionId, data }); }
  resizeTerminal(sessionId: string, cols: number, rows: number) { this.ws.send({ type: "terminal.resize", sessionId, cols, rows }); }

  listWorkspaces() { return req<Workspace[]>("/workspaces"); }
  getWorkspace(id: string) { return req<WorkspaceDetail>(`/workspaces/${id}`); }
  createWorkspace(name: string) { return post<Workspace>("/workspaces", { name }); }
  deleteWorkspace(id: string) { return req<void>(`/workspaces/${id}`, { method: "DELETE" }); }
  renameWorkspace(id: string, name: string) { return post<Workspace>(`/workspaces/${id}/rename`, { name }); }
  gitAction(id: string, action: "pull" | "push" | "status") { return post<Workspace>(`/workspaces/${id}/git/${action}`); }

  listFiles(path: string) { return req<FileEntry[]>(`/files?path=${encodeURIComponent(path)}`); }
  readFile(path: string) { return req<{ content: string; truncated: boolean }>(`/files/content?path=${encodeURIComponent(path)}`); }
  createFolder(path: string, name: string) { return post<FileEntry>("/files/folder", { path, name }); }
  renameFile(path: string, newName: string) { return post<FileEntry>("/files/rename", { path, newName }); }
  deleteFile(path: string) { return post<void>("/files/delete", { path }); }
  async uploadFile(path: string, file: File) {
    const fd = new FormData();
    fd.append("path", path);
    fd.append("file", file);
    const res = await fetch(`${API}/api/v1/files/upload`, { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return (await res.json()) as FileEntry;
  }

  getLogs(category?: LogCategory, severity?: LogSeverity, q?: string) {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (severity) p.set("severity", severity);
    if (q) p.set("q", q);
    return req<LogEntry[]>(`/logs?${p.toString()}`);
  }
  getActivity() { return req<ActivityEvent[]>("/activity"); }
  getConnections() { return req<ConnectionInfo[]>("/connections"); }
  pairDevice(code: string) { return post<ConnectionInfo>("/connections/pair", { code }); }
  revokeConnection(id: string) { return req<void>(`/connections/${id}`, { method: "DELETE" }); }
  rotateCredentials() { return post<void>("/connections/rotate"); }
  setRemoteAccess(enabled: boolean) { return post<void>("/connections/remote-access", { enabled }); }

  getAgentConfig(agent: "opencode" | "openclaw") { return req<AgentConfig>(`/agents/${agent}/config`); }
  saveAgentConfig(cfg: AgentConfig, secret?: string) { return post<AgentConfig>(`/agents/${cfg.agent}/config`, { ...cfg, secret }); }
  getSettings() { return req<StationSettings>("/settings"); }
  saveSettings(s: StationSettings) { return post<StationSettings>("/settings", s); }

  subscribe(handler: (e: WsEvent) => void) { return this.ws.subscribe(handler); }
  connectionState() { return this.ws.state(); }
}
