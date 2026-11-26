import type {
  ActivityEvent, AgentConfig, ConnectionInfo, FileEntry, LogCategory, LogEntry,
  LogSeverity, ServiceId, ServiceInfo, StationInfo, StationSettings, SystemMetrics,
  TerminalSession, Workspace, WorkspaceDetail, WsEvent,
} from "./types";
import type { StationProvider } from "./provider";

// ---------------------------------------------------------------------------
// MockStationProvider — clearly-labelled SIMULATED environment.
// Every value here is synthetic and must never be mistaken for live device data.
// The UI shows a persistent "SIMULATED" banner whenever this provider is active.
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const iso = (d: Date) => d.toISOString();
const now = () => new Date();

let seq = 100;
const nid = (p: string) => `${p}-${++seq}`;

const baseStation: StationInfo = {
  id: "station-sim-01",
  name: "Founda Dock (Simulated)",
  deviceName: "Simulated Android Device",
  status: "connected",
  connectionType: "local",
  runtimeMode: "hybrid",
  uptimeSeconds: 3 * 3600 + 42 * 60,
  lastHeartbeat: iso(now()),
  version: "0.1.0-sim",
  apiVersion: "v1",
};

let station: StationInfo = { ...baseStation };

const services: ServiceInfo[] = [
  { id: "station-api", name: "Station API", status: "running", pid: 12041, uptimeSeconds: 3 * 3600, lastHealthCheck: iso(now()), endpoint: "http://192.168.1.42:4310", version: "0.1.0-sim", supports: { start: true, stop: true, restart: true, logs: true } },
  { id: "terminal-engine", name: "Terminal Engine", status: "running", pid: 12055, uptimeSeconds: 3 * 3600, lastHealthCheck: iso(now()), endpoint: null, version: "0.1.0-sim", supports: { start: true, stop: true, restart: true, logs: true } },
  { id: "opencode", name: "OpenCode", status: "running", pid: 12108, uptimeSeconds: 47 * 60, lastHealthCheck: iso(now()), endpoint: "http://127.0.0.1:4096", version: "1.2.4", supports: { start: true, stop: true, restart: true, logs: true } },
  { id: "openclaw", name: "OpenClaw", status: "stopped", pid: null, uptimeSeconds: null, lastHealthCheck: iso(now()), endpoint: null, version: "2.0.1", supports: { start: true, stop: true, restart: true, logs: true } },
  { id: "tunnel", name: "Connection Tunnel", status: "stopped", pid: null, uptimeSeconds: null, lastHealthCheck: iso(now()), endpoint: null, version: null, supports: { start: true, stop: true, restart: true, logs: true } },
];

let sessions: TerminalSession[] = [
  { id: "sess-sim-1", name: "main", cwd: "~/projects/founda-dock", pid: 12061, createdAt: iso(new Date(Date.now() - 42 * 60000)), status: "active", exitCode: null },
  { id: "sess-sim-2", name: "agent-run", cwd: "~/projects/api-server", pid: 12120, createdAt: iso(new Date(Date.now() - 9 * 60000)), status: "active", exitCode: null },
];

let workspaces: Workspace[] = [
  { id: "ws-1", name: "founda-dock", path: "~/projects/founda-dock", type: "Next.js", gitBranch: "main", gitStatus: "dirty", lastModified: iso(new Date(Date.now() - 12 * 60000)), lastCommit: "a1b2c3d feat: terminal tabs" },
  { id: "ws-2", name: "api-server", path: "~/projects/api-server", type: "Node.js", gitBranch: "develop", gitStatus: "clean", lastModified: iso(new Date(Date.now() - 3 * 3600000)), lastCommit: "9f8e7d6 fix: ws reconnect" },
  { id: "ws-3", name: "notes-app", path: "~/projects/notes-app", type: "React", gitBranch: null, gitStatus: "not-a-repo", lastModified: iso(new Date(Date.now() - 26 * 3600000)), lastCommit: null },
];

const fileTree: Record<string, FileEntry[]> = {
  "~/projects/founda-dock": [
    { name: "src", path: "~/projects/founda-dock/src", type: "dir", sizeBytes: null, modifiedAt: iso(now()), extension: null },
    { name: "package.json", path: "~/projects/founda-dock/package.json", type: "file", sizeBytes: 842, modifiedAt: iso(now()), extension: "json" },
    { name: "README.md", path: "~/projects/founda-dock/README.md", type: "file", sizeBytes: 2410, modifiedAt: iso(now()), extension: "md" },
    { name: ".env.local", path: "~/projects/founda-dock/.env.local", type: "file", sizeBytes: 128, modifiedAt: iso(now()), extension: null },
  ],
  "~/projects/founda-dock/src": [
    { name: "app", path: "~/projects/founda-dock/src/app", type: "dir", sizeBytes: null, modifiedAt: iso(now()), extension: null },
    { name: "lib", path: "~/projects/founda-dock/src/lib", type: "dir", sizeBytes: null, modifiedAt: iso(now()), extension: null },
    { name: "main.ts", path: "~/projects/founda-dock/src/main.ts", type: "file", sizeBytes: 512, modifiedAt: iso(now()), extension: "ts" },
  ],
  "~/projects": [
    { name: "founda-dock", path: "~/projects/founda-dock", type: "dir", sizeBytes: null, modifiedAt: iso(now()), extension: null },
    { name: "api-server", path: "~/projects/api-server", type: "dir", sizeBytes: null, modifiedAt: iso(now()), extension: null },
    { name: "notes-app", path: "~/projects/notes-app", type: "dir", sizeBytes: null, modifiedAt: iso(now()), extension: null },
  ],
};

const logs: LogEntry[] = [
  { id: nid("log"), ts: iso(new Date(Date.now() - 5 * 60000)), category: "station", severity: "info", message: "Station connected via local network" },
  { id: nid("log"), ts: iso(new Date(Date.now() - 4 * 60000)), category: "opencode", severity: "info", message: "OpenCode server started on port 4096" },
  { id: nid("log"), ts: iso(new Date(Date.now() - 3 * 60000)), category: "terminal", severity: "debug", message: "Terminal session sess-sim-2 created" },
  { id: nid("log"), ts: iso(new Date(Date.now() - 2 * 60000)), category: "connections", severity: "warning", message: "Tunnel disconnected — remote access unavailable" },
  { id: nid("log"), ts: iso(new Date(Date.now() - 60000)), category: "system", severity: "info", message: "Health check passed (all services)" },
];

let activity: ActivityEvent[] = [
  { id: nid("act"), ts: iso(new Date(Date.now() - 5 * 60000)), kind: "station", message: "Station connected" },
  { id: nid("act"), ts: iso(new Date(Date.now() - 4 * 60000)), kind: "service", message: "OpenCode started" },
  { id: nid("act"), ts: iso(new Date(Date.now() - 3 * 60000)), kind: "terminal", message: "Terminal session created (agent-run)" },
  { id: nid("act"), ts: iso(new Date(Date.now() - 2 * 60000)), kind: "workspace", message: "Workspace opened: founda-dock" },
  { id: nid("act"), ts: iso(new Date(Date.now() - 60000)), kind: "git", message: "Git operation completed: pull on api-server" },
];

let connections: ConnectionInfo[] = [
  { id: "conn-local", kind: "local", status: "connected", endpoint: "http://192.168.1.42:4310", lastHeartbeat: iso(now()), lastSuccessful: iso(now()), authenticated: true, label: "Local network" },
  { id: "conn-remote", kind: "remote", status: "disconnected", endpoint: null, lastHeartbeat: null, lastSuccessful: iso(new Date(Date.now() - 26 * 3600000)), authenticated: false, label: "Remote tunnel" },
];

const agentConfigs: Record<string, AgentConfig> = {
  opencode: { agent: "opencode", startupBehaviour: "manual", workingDirectory: "~/projects/founda-dock", port: 4096, endpoint: "http://127.0.0.1:4096", hasSecret: true },
  openclaw: { agent: "openclaw", startupBehaviour: "auto", workingDirectory: "~/projects", port: 18789, endpoint: "http://127.0.0.1:18789", hasSecret: false },
};

let settings: StationSettings = {
  stationName: "Founda Dock (Simulated)",
  theme: "dark",
  timeFormat: "24h",
  defaultWorkspace: "~/projects/founda-dock",
  defaultShell: "bash",
  hybridRuntimeMode: true,
  healthCheckIntervalSec: 15,
  sessionTimeoutMin: 30,
  remoteAccessEnabled: false,
  notifications: { connectionChanges: true, serviceFailures: true, agentCompletion: false, runtimeInterruptions: true },
};

const handlers = new Set<(e: WsEvent) => void>();
function emit(e: WsEvent) { handlers.forEach((h) => h(e)); }

function metrics(): SystemMetrics {
  const cpu = 18 + Math.round(Math.random() * 14);
  const mem = 46 + Math.round(Math.random() * 8);
  const hist = Array.from({ length: 24 }, (_, i) => ({
    t: iso(new Date(Date.now() - (23 - i) * 60000)),
    cpu: Math.max(4, cpu - 10 + Math.round(Math.random() * 18)),
    mem: Math.max(20, mem - 6 + Math.round(Math.random() * 10)),
  }));
  return {
    cpuPercent: cpu, memoryPercent: mem, memoryUsedMb: 1840, memoryTotalMb: 4096,
    storagePercent: 61, storageUsedGb: 39, storageTotalGb: 64,
    uptimeSeconds: station.uptimeSeconds, history: hist,
  };
}

export class MockStationProvider implements StationProvider {
  readonly mode = "mock" as const;
  readonly label = "SIMULATED";

  async getStation() { await delay(120); return { ...station, lastHeartbeat: iso(now()) }; }
  async getSystem() { await delay(120); return metrics(); }
  async getServices() { await delay(120); return services.map((s) => ({ ...s })); }

  private async setService(id: ServiceId, status: ServiceInfo["status"]) {
    const s = services.find((x) => x.id === id)!;
    s.status = status;
    s.lastHealthCheck = iso(now());
    if (status === "running") { s.pid = s.pid ?? 12000 + Math.floor(Math.random() * 900); s.uptimeSeconds = 0; }
    if (status === "stopped") { s.pid = null; s.uptimeSeconds = null; }
    emit({ type: "service.status", ts: iso(now()), payload: { service: { ...s } } });
    return { ...s };
  }

  async startService(id: ServiceId) { await delay(400); return this.setService(id, "running"); }
  async stopService(id: ServiceId) { await delay(400); return this.setService(id, "stopped"); }
  async restartService(id: ServiceId) { await delay(600); return this.setService(id, "running"); }

  async startStation() { await delay(400); station = { ...station, status: "running" }; return { ...station }; }
  async stopStation() { await delay(400); station = { ...station, status: "disconnected" }; return { ...station }; }
  async restartStation() { await delay(600); station = { ...station, status: "running", uptimeSeconds: 0 }; return { ...station }; }

  async listSessions() { await delay(100); return sessions.map((s) => ({ ...s })); }
  async createSession(cwd?: string) {
    await delay(200);
    const s: TerminalSession = { id: nid("sess"), name: `session-${sessions.length + 1}`, cwd: cwd ?? "~/projects/founda-dock", pid: 12000 + Math.floor(Math.random() * 900), createdAt: iso(now()), status: "active", exitCode: null };
    sessions.push(s);
    emit({ type: "terminal.status", ts: iso(now()), payload: { sessionId: s.id, status: "active" } });
    return { ...s };
  }
  async deleteSession(id: string) { await delay(150); sessions = sessions.filter((s) => s.id !== id); }
  terminalSocketUrl() { return "ws://mock/terminal"; }
  sendTerminalInput(sessionId: string, data: string) {
    // Simulated echo so the terminal feels alive in demo mode.
    const echo = data === "\r" ? "\r\n$ " : data;
    emit({ type: "terminal.output", ts: iso(now()), payload: { sessionId, data: echo } });
  }
  resizeTerminal() { /* no-op in mock */ }

  async listWorkspaces() { await delay(120); return workspaces.map((w) => ({ ...w })); }
  async getWorkspace(id: string): Promise<WorkspaceDetail> {
    await delay(120);
    const w = workspaces.find((x) => x.id === id);
    if (!w) throw new Error("Workspace not found");
    return {
      ...w,
      commits: [
        { hash: "a1b2c3d", message: "feat: terminal tabs", date: iso(new Date(Date.now() - 3600000)) },
        { hash: "9f8e7d6", message: "fix: ws reconnect backoff", date: iso(new Date(Date.now() - 7200000)) },
        { hash: "4c5b6a7", message: "chore: deps", date: iso(new Date(Date.now() - 86400000)) },
      ],
      tree: fileTree[w.path] ?? [],
    };
  }
  async createWorkspace(name: string) {
    await delay(250);
    const w: Workspace = { id: nid("ws"), name, path: `~/projects/${name}`, type: "Unknown", gitBranch: null, gitStatus: "not-a-repo", lastModified: iso(now()), lastCommit: null };
    workspaces.push(w);
    return { ...w };
  }
  async deleteWorkspace(id: string) { await delay(200); workspaces = workspaces.filter((w) => w.id !== id); }
  async renameWorkspace(id: string, name: string) {
    await delay(200);
    const w = workspaces.find((x) => x.id === id)!;
    w.name = name;
    return { ...w };
  }
  async gitAction(id: string, action: "pull" | "push" | "status") {
    await delay(500);
    const w = workspaces.find((x) => x.id === id)!;
    if (action === "status") return { ...w };
    activity = [{ id: nid("act"), ts: iso(now()), kind: "git", message: `Git ${action} completed on ${w.name}` }, ...activity];
    return { ...w, lastModified: iso(now()) };
  }

  async listFiles(path: string) {
    await delay(120);
    const entries = fileTree[path];
    if (!entries) throw new Error(`Permission denied: ${path} is outside permitted workspace directories`);
    return entries.map((e) => ({ ...e }));
  }
  async readFile(path: string) {
    await delay(120);
    if (path.endsWith(".md")) return { content: "# Founda Dock (Simulated)\n\nThis is a simulated file preview.\n", truncated: false };
    if (path.endsWith(".json")) return { content: '{\n  "name": "founda-dock",\n  "simulated": true\n}\n', truncated: false };
    return { content: "// Simulated file content\n", truncated: false };
  }
  async createFolder(path: string, name: string) {
    await delay(200);
    const entry: FileEntry = { name, path: `${path}/${name}`, type: "dir", sizeBytes: null, modifiedAt: iso(now()), extension: null };
    (fileTree[path] ??= []).push(entry);
    return { ...entry };
  }
  async renameFile(path: string, newName: string) {
    await delay(200);
    const dir = path.slice(0, path.lastIndexOf("/"));
    const list = fileTree[dir] ?? [];
    const f = list.find((e) => e.path === path);
    if (f) { f.name = newName; f.path = `${dir}/${newName}`; }
    return { ...f! };
  }
  async deleteFile(path: string) {
    await delay(200);
    const dir = path.slice(0, path.lastIndexOf("/"));
    fileTree[dir] = (fileTree[dir] ?? []).filter((e) => e.path !== path);
  }
  async uploadFile(path: string, file: File) {
    await delay(300);
    const entry: FileEntry = { name: file.name, path: `${path}/${file.name}`, type: "file", sizeBytes: file.size, modifiedAt: iso(now()), extension: file.name.split(".").pop() ?? null };
    (fileTree[path] ??= []).push(entry);
    return { ...entry };
  }

  async getLogs(category?: LogCategory, severity?: LogSeverity, q?: string) {
    await delay(120);
    return logs.filter((l) =>
      (!category || l.category === category) &&
      (!severity || l.severity === severity) &&
      (!q || l.message.toLowerCase().includes(q.toLowerCase()))
    );
  }
  async getActivity() { await delay(100); return [...activity]; }
  async getConnections() { await delay(100); return connections.map((c) => ({ ...c })); }
  async pairDevice(code: string) {
    await delay(600);
    if (code.trim().length < 4) throw new Error("Invalid pairing code");
    const c: ConnectionInfo = { id: nid("conn"), kind: "remote", status: "connected", endpoint: "https://tunnel.founda.example", lastHeartbeat: iso(now()), lastSuccessful: iso(now()), authenticated: true, label: `Paired browser (${code.slice(0, 4)}…)` };
    connections.push(c);
    return { ...c };
  }
  async revokeConnection(id: string) { await delay(200); connections = connections.filter((c) => c.id !== id); }
  async rotateCredentials() { await delay(300); }
  async setRemoteAccess(enabled: boolean) {
    await delay(300);
    settings.remoteAccessEnabled = enabled;
    const remote = connections.find((c) => c.kind === "remote")!;
    remote.status = enabled ? "connected" : "disconnected";
    remote.endpoint = enabled ? "https://tunnel.founda.example" : null;
  }

  async getAgentConfig(agent: "opencode" | "openclaw") { await delay(100); return { ...agentConfigs[agent] }; }
  async saveAgentConfig(cfg: AgentConfig, secret?: string) {
    await delay(250);
    agentConfigs[cfg.agent] = { ...cfg, hasSecret: secret ? true : cfg.hasSecret };
    return { ...agentConfigs[cfg.agent] };
  }
  async getSettings() { await delay(100); return { ...settings }; }
  async saveSettings(s: StationSettings) { await delay(250); settings = { ...s }; return { ...settings }; }

  subscribe(handler: (e: WsEvent) => void) { handlers.add(handler); return () => handlers.delete(handler); }
  connectionState() { return "connected" as const; }
}
