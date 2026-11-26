import { z } from "zod";

// Runtime validation for every payload crossing the API / WebSocket boundary.
// The real runtime is untrusted input from the frontend's perspective.

export const StationStatusSchema = z.enum([
  "connected", "connecting", "running", "background-active",
  "idle", "disconnected", "interrupted", "error",
]);

export const ServiceStatusSchema = z.enum(["running", "stopped", "starting", "stopping", "error", "unknown"]);

export const ServiceIdSchema = z.enum(["station-api", "terminal-engine", "opencode", "openclaw", "tunnel"]);

export const StationInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  deviceName: z.string(),
  status: StationStatusSchema,
  connectionType: z.enum(["local", "remote", "none"]),
  runtimeMode: z.enum(["hybrid", "foreground", "background"]),
  uptimeSeconds: z.number().nullable(),
  lastHeartbeat: z.string().nullable(),
  version: z.string(),
  apiVersion: z.string(),
});

export const MetricPointSchema = z.object({
  t: z.string(),
  cpu: z.number().nullable(),
  mem: z.number().nullable(),
});

export const SystemMetricsSchema = z.object({
  cpuPercent: z.number().nullable(),
  memoryPercent: z.number().nullable(),
  memoryUsedMb: z.number().nullable(),
  memoryTotalMb: z.number().nullable(),
  storagePercent: z.number().nullable(),
  storageUsedGb: z.number().nullable(),
  storageTotalGb: z.number().nullable(),
  uptimeSeconds: z.number().nullable(),
  history: z.array(MetricPointSchema),
});

export const ServiceInfoSchema = z.object({
  id: ServiceIdSchema,
  name: z.string(),
  status: ServiceStatusSchema,
  pid: z.number().nullable(),
  uptimeSeconds: z.number().nullable(),
  lastHealthCheck: z.string().nullable(),
  endpoint: z.string().nullable(),
  version: z.string().nullable(),
  supports: z.object({ start: z.boolean(), stop: z.boolean(), restart: z.boolean(), logs: z.boolean() }),
});

export const TerminalSessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  cwd: z.string(),
  pid: z.number().nullable(),
  createdAt: z.string(),
  status: z.enum(["active", "exited", "reconnecting", "expired"]),
  exitCode: z.number().nullable(),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  type: z.string(),
  gitBranch: z.string().nullable(),
  gitStatus: z.enum(["clean", "dirty", "not-a-repo", "unknown"]),
  lastModified: z.string(),
  lastCommit: z.string().nullable(),
});

export const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "dir"]),
  sizeBytes: z.number().nullable(),
  modifiedAt: z.string(),
  extension: z.string().nullable(),
});

export const LogEntrySchema = z.object({
  id: z.string(),
  ts: z.string(),
  category: z.enum(["station", "terminal", "opencode", "openclaw", "connections", "system"]),
  severity: z.enum(["debug", "info", "warning", "error", "critical"]),
  message: z.string(),
});

export const ConnectionInfoSchema = z.object({
  id: z.string(),
  kind: z.enum(["local", "remote"]),
  status: z.enum(["connected", "disconnected", "connecting", "error"]),
  endpoint: z.string().nullable(),
  lastHeartbeat: z.string().nullable(),
  lastSuccessful: z.string().nullable(),
  authenticated: z.boolean(),
  label: z.string(),
});

export const WsEventSchema = z.object({
  type: z.enum([
    "terminal.output", "terminal.status", "terminal.exit", "station.status",
    "station.metrics", "service.status", "service.logs", "workspace.updated",
    "connection.status", "runtime.error",
  ]),
  ts: z.string(),
  payload: z.unknown(),
});

// Safe parse helper: returns null instead of throwing on malformed payloads.
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const r = schema.safeParse(data);
  return r.success ? r.data : null;
}
