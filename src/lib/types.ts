// Founda Dock — domain types shared by Mock and Real providers.
// The UI only ever depends on these types + StationProvider, never on transport details.

export type StationStatus =
  | "connected"
  | "connecting"
  | "running"
  | "background-active"
  | "idle"
  | "disconnected"
  | "interrupted"
  | "error";

export type ServiceStatus = "running" | "stopped" | "starting" | "stopping" | "error" | "unknown";

export type ServiceId = "station-api" | "terminal-engine" | "opencode" | "openclaw" | "tunnel";

export interface StationInfo {
  id: string;
  name: string;
  deviceName: string;
  status: StationStatus;
  connectionType: "local" | "remote" | "none";
  runtimeMode: "hybrid" | "foreground" | "background";
  uptimeSeconds: number | null;
  lastHeartbeat: string | null; // ISO
  version: string;
  apiVersion: string;
}

export interface SystemMetrics {
  cpuPercent: number | null;
  memoryPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  storagePercent: number | null;
  storageUsedGb: number | null;
  storageTotalGb: number | null;
  uptimeSeconds: number | null;
  history: MetricPoint[];
}

export interface MetricPoint {
  t: string; // ISO
  cpu: number | null;
  mem: number | null;
}

export interface DeviceInfo {
  deviceName: string;
  androidVersion: string | null;
  architecture: string | null;
  kernel: string | null;
  termuxVersion: string | null;
  nodeVersion: string | null;
  storageAvailableGb: number | null;
}

export interface ServiceInfo {
  id: ServiceId;
  name: string;
  status: ServiceStatus;
  pid: number | null;
  uptimeSeconds: number | null;
  lastHealthCheck: string | null;
  endpoint: string | null; // never contains credentials
  version: string | null;
  supports: { start: boolean; stop: boolean; restart: boolean; logs: boolean };
}

export interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  pid: number | null;
  createdAt: string;
  status: "active" | "exited" | "reconnecting" | "expired";
  exitCode: number | null;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  type: string;
  gitBranch: string | null;
  gitStatus: "clean" | "dirty" | "not-a-repo" | "unknown";
  lastModified: string;
  lastCommit: string | null;
}

export interface WorkspaceDetail extends Workspace {
  commits: { hash: string; message: string; date: string }[];
  tree: FileEntry[];
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  sizeBytes: number | null;
  modifiedAt: string;
  extension: string | null;
}

export type LogCategory = "station" | "terminal" | "opencode" | "openclaw" | "connections" | "system";
export type LogSeverity = "debug" | "info" | "warning" | "error" | "critical";

export interface LogEntry {
  id: string;
  ts: string;
  category: LogCategory;
  severity: LogSeverity;
  message: string;
}

export interface ActivityEvent {
  id: string;
  ts: string;
  kind: string;
  message: string;
}

export interface ConnectionInfo {
  id: string;
  kind: "local" | "remote";
  status: "connected" | "disconnected" | "connecting" | "error";
  endpoint: string | null;
  lastHeartbeat: string | null;
  lastSuccessful: string | null;
  authenticated: boolean;
  label: string;
}

export interface AgentConfig {
  agent: "opencode" | "openclaw";
  startupBehaviour: "manual" | "auto";
  workingDirectory: string;
  port: number | null;
  endpoint: string | null;
  // Secrets are write-only: the API never returns them. We track only whether one is set.
  hasSecret: boolean;
}

export interface StationSettings {
  stationName: string;
  theme: "dark" | "light";
  timeFormat: "24h" | "12h";
  defaultWorkspace: string;
  defaultShell: string;
  hybridRuntimeMode: boolean;
  healthCheckIntervalSec: number;
  sessionTimeoutMin: number;
  remoteAccessEnabled: boolean;
  notifications: { connectionChanges: boolean; serviceFailures: boolean; agentCompletion: boolean; runtimeInterruptions: boolean };
}

// WebSocket event envelope (validated with Zod in schemas.ts)
export type WsEventType =
  | "terminal.output"
  | "terminal.status"
  | "terminal.exit"
  | "station.status"
  | "station.metrics"
  | "service.status"
  | "service.logs"
  | "workspace.updated"
  | "connection.status"
  | "runtime.error";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  ts: string;
  payload: T;
}

export interface TerminalOutputPayload { sessionId: string; data: string }
export interface TerminalStatusPayload { sessionId: string; status: TerminalSession["status"] }
export interface TerminalExitPayload { sessionId: string; exitCode: number | null }
export interface StationStatusPayload { status: StationStatus; lastHeartbeat: string }
export interface StationMetricsPayload { metrics: SystemMetrics }
export interface ServiceStatusPayload { service: ServiceInfo }
export interface ServiceLogsPayload { service: ServiceId; lines: LogEntry[] }
export interface WorkspaceUpdatedPayload { workspace: Workspace }
export interface ConnectionStatusPayload { connection: ConnectionInfo }
export interface RuntimeErrorPayload { code: string; message: string; sessionId?: string }
