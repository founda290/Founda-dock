import type {
  ActivityEvent, AgentConfig, ConnectionInfo, FileEntry, LogCategory, LogEntry,
  LogSeverity, ServiceId, ServiceInfo, StationInfo, StationSettings, SystemMetrics,
  TerminalSession, Workspace, WorkspaceDetail, WsEvent,
} from "./types";

// The single seam between UI and transport. UI code never imports fetch/WebSocket directly.
// Implementations: MockStationProvider (simulated) and RealStationProvider (HTTP+WS).

export interface StationProvider {
  readonly mode: "mock" | "real";
  readonly label: string; // e.g. "SIMULATED" or "LIVE"

  getStation(): Promise<StationInfo>;
  getSystem(): Promise<SystemMetrics>;
  getServices(): Promise<ServiceInfo[]>;
  startService(id: ServiceId): Promise<ServiceInfo>;
  stopService(id: ServiceId): Promise<ServiceInfo>;
  restartService(id: ServiceId): Promise<ServiceInfo>;
  startStation(): Promise<StationInfo>;
  stopStation(): Promise<StationInfo>;
  restartStation(): Promise<StationInfo>;

  listSessions(): Promise<TerminalSession[]>;
  createSession(cwd?: string): Promise<TerminalSession>;
  deleteSession(id: string): Promise<void>;
  terminalSocketUrl(sessionId: string): string;
  sendTerminalInput(sessionId: string, data: string): void;
  resizeTerminal(sessionId: string, cols: number, rows: number): void;

  listWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<WorkspaceDetail>;
  createWorkspace(name: string): Promise<Workspace>;
  deleteWorkspace(id: string): Promise<void>;
  renameWorkspace(id: string, name: string): Promise<Workspace>;
  gitAction(id: string, action: "pull" | "push" | "status"): Promise<Workspace>;

  listFiles(path: string): Promise<FileEntry[]>;
  readFile(path: string): Promise<{ content: string; truncated: boolean }>;
  createFolder(path: string, name: string): Promise<FileEntry>;
  renameFile(path: string, newName: string): Promise<FileEntry>;
  deleteFile(path: string): Promise<void>;
  uploadFile(path: string, file: File): Promise<FileEntry>;

  getLogs(category?: LogCategory, severity?: LogSeverity, q?: string): Promise<LogEntry[]>;
  getActivity(): Promise<ActivityEvent[]>;
  getConnections(): Promise<ConnectionInfo[]>;
  pairDevice(code: string): Promise<ConnectionInfo>;
  revokeConnection(id: string): Promise<void>;
  rotateCredentials(): Promise<void>;
  setRemoteAccess(enabled: boolean): Promise<void>;

  getAgentConfig(agent: "opencode" | "openclaw"): Promise<AgentConfig>;
  saveAgentConfig(cfg: AgentConfig, secret?: string): Promise<AgentConfig>;
  getSettings(): Promise<StationSettings>;
  saveSettings(s: StationSettings): Promise<StationSettings>;

  subscribe(handler: (e: WsEvent) => void): () => void;
  connectionState(): "connected" | "connecting" | "disconnected";
}

export type ProviderMode = "mock" | "real";

export function getProviderMode(): ProviderMode {
  // NEXT_PUBLIC_STATION_MODE=real + NEXT_PUBLIC_STATION_API_URL enables the real runtime.
  // Default is mock so the UI is fully usable before the Android runtime exists.
  const m = process.env.NEXT_PUBLIC_STATION_MODE;
  return m === "real" ? "real" : "mock";
}
