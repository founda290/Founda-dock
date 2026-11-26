import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { loadConfig, dataDir } from "./config.js";
import {
  verifySession, hasPermission, extractToken, consumePairingCode,
  checkPairingRateLimit, createSession, revokeSession, listSessions,
  FULL_PERMISSIONS, type Permission,
} from "./security/auth.js";
import { PathError } from "./security/paths.js";
import { collectMetrics, deviceInfo } from "./monitoring/system.js";
import { listStatuses, getStatus, startService, stopService, restartService, getLogTail } from "./services/supervisor.js";
import { agentInfo, agentStart, agentStop, agentRestart, agentLogs } from "./agents/adapters.js";
import * as term from "./terminal/sessions.js";
import * as ws from "./workspace/files.js";
import { broadcast, clientCount } from "./websocket/hub.js";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// HTTP API routes. Every route except /health and /connections/pair requires
// a valid session token with the appropriate permission. Errors never leak
// stack traces or secrets.
// ---------------------------------------------------------------------------

const startedAt = Date.now();

function log(category: string, severity: string, message: string): void {
  try {
    mkdirSync(join(dataDir(), "logs"), { recursive: true });
    appendFileSync(join(dataDir(), "logs", "station.log"), `${new Date().toISOString()} [${category}] [${severity}] ${message}\n`);
  } catch { /* logging must never crash the API */ }
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  const cfg = loadConfig();

  // --- Auth middleware -----------------------------------------------------
  app.addHook("onRequest", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (path === "/api/v1/health" || path === "/api/v1/connections/pair") return;
    const token = extractToken(req);
    const session = verifySession(token);
    if (!session) {
      reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }
    (req as unknown as { session: typeof session }).session = session;
  });

  const requirePerm = (perm: Permission) =>
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const s = (req as unknown as { session?: { permissions: Permission[] } }).session;
      if (!s || !hasPermission(s as never, perm)) {
        await reply.code(403).send({ error: { code: "FORBIDDEN", message: `Missing permission: ${perm}` } });
      }
    };

  const fail = (reply: FastifyReply, err: unknown) => {
    if (err instanceof PathError) return reply.code(400).send({ error: { code: "BAD_PATH", message: err.message } });
    const msg = err instanceof Error ? err.message : "Internal error";
    return reply.code(500).send({ error: { code: "INTERNAL", message: msg } });
  };

  // --- Health / station ----------------------------------------------------
  app.get("/api/v1/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  app.get("/api/v1/station", { preHandler: requirePerm("metrics:read") }, async () => {
    const services = listStatuses();
    return {
      id: cfg.stationId,
      name: cfg.stationName,
      deviceName: deviceInfo().deviceName,
      status: "connected",
      connectionType: "local",
      runtimeMode: "hybrid",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      lastHeartbeat: new Date().toISOString(),
      version: "0.2.0",
      apiVersion: "v1",
      connectedClients: clientCount(),
      services: services.map((s) => ({ id: s.id, state: s.state, installed: s.installed })),
      capabilities: { tmux: term.tmuxAvailable(), opencode: services.some((s) => s.id === "opencode" && s.installed), openclaw: services.some((s) => s.id === "openclaw" && s.installed) },
    };
  });

  app.get("/api/v1/system", { preHandler: requirePerm("metrics:read") }, async () => collectMetrics());

  app.get("/api/v1/services", { preHandler: requirePerm("metrics:read") }, async () => {
    const base = listStatuses();
    const agents = await Promise.all([
      agentInfo("opencode", cfg.opencodeBin),
      agentInfo("openclaw", cfg.openclawBin),
    ]);
    const map: Record<string, { endpoint: string | null; version: string | null }> = {
      opencode: { endpoint: agents[0].endpoint, version: agents[0].version },
      openclaw: { endpoint: agents[1].endpoint, version: agents[1].version },
    };
    return base.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.state === "RUNNING" ? "running" : s.state === "FAILED" ? "error" : s.state === "UNAVAILABLE" ? "unknown" : s.state === "STARTING" ? "starting" : s.state === "STOPPING" ? "stopping" : "stopped",
      pid: s.pid,
      uptimeSeconds: s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000) : null,
      lastHealthCheck: new Date().toISOString(),
      endpoint: map[s.id]?.endpoint ?? null,
      version: map[s.id]?.version ?? null,
      supports: { start: true, stop: true, restart: true, logs: true },
    }));
  });

  const ServiceParam = z.object({ service: z.string() });
  for (const action of ["start", "stop", "restart"] as const) {
    app.post(`/api/v1/services/:service/${action}`, { preHandler: requirePerm("agents:manage") }, async (req, reply) => {
      const { service } = ServiceParam.parse(req.params);
      try {
        const fn = action === "start" ? startService : action === "stop" ? stopService : restartService;
        const status = await fn(service);
        broadcast("service.status", { service: status });
        log("station", "info", `Service ${service} ${action} -> ${status.state}`);
        return status;
      } catch (err) { return fail(reply, err); }
    });
  }

  app.get("/api/v1/services/:service/logs", { preHandler: requirePerm("metrics:read") }, async (req) => {
    const { service } = ServiceParam.parse(req.params);
    return getLogTail(service).map((message, i) => ({ id: `${service}-${i}`, ts: new Date().toISOString(), category: service, severity: "info", message }));
  });

  // --- Terminal --------------------------------------------------------------
  app.get("/api/v1/terminal/sessions", { preHandler: requirePerm("terminal:create") }, async () => term.listSessions());

  app.post("/api/v1/terminal/sessions", { preHandler: requirePerm("terminal:create") }, async (req, reply) => {
    const body = z.object({ cwd: z.string().optional() }).parse(req.body ?? {});
    const cwd = body.cwd ?? cfg.workspaceRoots[0];
    try {
      const s = await term.createSession(cwd, cfg.defaultShell);
      broadcast("terminal.status", { sessionId: s.id, status: s.status });
      log("terminal", "info", `Session created: ${s.id} cwd=${cwd}`);
      return reply.code(201).send(s);
    } catch (err) { return fail(reply, err); }
  });

  app.get("/api/v1/terminal/sessions/:id", { preHandler: requirePerm("terminal:create") }, async (req, reply) => {
    const s = await term.getSession((req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Session not found" } });
    return s;
  });

  app.delete("/api/v1/terminal/sessions/:id", { preHandler: requirePerm("destructive") }, async (req) => {
    await term.deleteSession((req.params as { id: string }).id);
    return { ok: true };
  });

  // --- Workspaces --------------------------------------------------------------
  app.get("/api/v1/workspaces", { preHandler: requirePerm("workspaces:read") }, async () => ws.listWorkspaces(cfg.workspaceRoots));

  app.post("/api/v1/workspaces", { preHandler: requirePerm("files:write") }, async (req, reply) => {
    const body = z.object({ name: z.string().min(1).max(64) }).parse(req.body);
    try {
      const { createFolder } = await import("./workspace/files.js");
      const entry = createFolder(cfg.workspaceRoots[0], body.name, cfg.workspaceRoots);
      const desc = await ws.describeWorkspace(entry.path);
      broadcast("workspace.updated", { workspace: desc });
      return reply.code(201).send(desc);
    } catch (err) { return fail(reply, err); }
  });

  app.get("/api/v1/workspaces/:id", { preHandler: requirePerm("workspaces:read") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const all = await ws.listWorkspaces(cfg.workspaceRoots);
    const found = all.find((w) => w.id === id);
    if (!found) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Workspace not found" } });
    return { ...found, commits: [], tree: ws.listDir(found.path, cfg.workspaceRoots) };
  });

  app.post("/api/v1/workspaces/:id/git/:action", { preHandler: requirePerm("files:write") }, async (req, reply) => {
    const { id, action } = req.params as { id: string; action: string };
    if (!["pull", "push", "status"].includes(action)) return reply.code(400).send({ error: { code: "BAD_ACTION", message: "Invalid git action" } });
    const all = await ws.listWorkspaces(cfg.workspaceRoots);
    const found = all.find((w) => w.id === id);
    if (!found) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Workspace not found" } });
    try { return await ws.gitAction(found.path, action as "pull" | "push" | "status"); }
    catch (err) { return fail(reply, err); }
  });

  // --- Files -------------------------------------------------------------------
  app.get("/api/v1/files", { preHandler: requirePerm("files:read") }, async (req, reply) => {
    const path = (req.query as { path?: string }).path ?? cfg.workspaceRoots[0];
    try { return ws.listDir(path, cfg.workspaceRoots); } catch (err) { return fail(reply, err); }
  });

  app.get("/api/v1/files/content", { preHandler: requirePerm("files:read") }, async (req, reply) => {
    const path = (req.query as { path?: string }).path ?? "";
    try { return ws.readTextFile(path, cfg.workspaceRoots); } catch (err) { return fail(reply, err); }
  });

  app.post("/api/v1/files/folder", { preHandler: requirePerm("files:write") }, async (req, reply) => {
    const body = z.object({ path: z.string(), name: z.string() }).parse(req.body);
    try { return ws.createFolder(body.path, body.name, cfg.workspaceRoots); } catch (err) { return fail(reply, err); }
  });

  app.post("/api/v1/files/rename", { preHandler: requirePerm("files:write") }, async (req, reply) => {
    const body = z.object({ path: z.string(), newName: z.string() }).parse(req.body);
    try { return ws.renamePath(body.path, body.newName, cfg.workspaceRoots); } catch (err) { return fail(reply, err); }
  });

  app.post("/api/v1/files/delete", { preHandler: requirePerm("destructive") }, async (req, reply) => {
    const body = z.object({ path: z.string() }).parse(req.body);
    try { ws.deletePath(body.path, cfg.workspaceRoots); return { ok: true }; } catch (err) { return fail(reply, err); }
  });

  // --- Logs ----------------------------------------------------------------------
  app.get("/api/v1/logs", { preHandler: requirePerm("metrics:read") }, async (req) => {
    const { category, severity, q } = req.query as { category?: string; severity?: string; q?: string };
    const { readFileSync, existsSync } = await import("node:fs");
    const logPath = join(dataDir(), "logs", "station.log");
    if (!existsSync(logPath)) return [];
    const lines = readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).slice(-500);
    return lines
      .map((line, i) => {
        const m = line.match(/^(\S+) \[(\w+)\] \[(\w+)\] (.*)$/);
        return { id: `log-${i}`, ts: m?.[1] ?? new Date().toISOString(), category: (m?.[2] ?? "station") as never, severity: (m?.[3] ?? "info") as never, message: m?.[4] ?? line };
      })
      .filter((l) => (!category || l.category === category) && (!severity || l.severity === severity) && (!q || l.message.toLowerCase().includes(q.toLowerCase())));
  });

  // --- Connections / pairing -------------------------------------------------------
  app.post("/api/v1/connections/pair", async (req, reply) => {
    const ip = req.ip ?? "unknown";
    if (!checkPairingRateLimit(ip, cfg.pairingMaxAttempts, cfg.pairingWindowSeconds)) {
      return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many pairing attempts" } });
    }
    const body = z.object({ code: z.string().min(6).max(6), label: z.string().max(64).optional() }).parse(req.body);
    if (!consumePairingCode(body.code)) {
      log("connections", "warning", `Failed pairing attempt from ${ip}`);
      return reply.code(401).send({ error: { code: "INVALID_CODE", message: "Invalid or expired pairing code" } });
    }
    const { token, session } = createSession(body.label ?? "browser", FULL_PERMISSIONS, cfg.sessionTtlHours);
    log("connections", "info", `Paired browser session ${session.id}`);
    broadcast("connection.status", { status: "paired", label: session.label });
    return reply.code(201).send({ token, session });
  });

  app.get("/api/v1/connections", { preHandler: requirePerm("connections:manage") }, async () => {
    return listSessions().map((s) => ({
      id: s.id, kind: "local" as const, status: "connected" as const,
      endpoint: null, lastHeartbeat: new Date().toISOString(), lastSuccessful: new Date(s.createdAt).toISOString(),
      authenticated: true, label: s.label,
    }));
  });

  app.delete("/api/v1/connections/:id", { preHandler: requirePerm("connections:manage") }, async (req, reply) => {
    const ok = revokeSession((req.params as { id: string }).id);
    if (!ok) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Session not found" } });
    return { ok: true };
  });

  // --- Agents ------------------------------------------------------------------------
  app.get("/api/v1/agents/:agent/config", { preHandler: requirePerm("agents:manage") }, async (req, reply) => {
    const { agent } = req.params as { agent: string };
    if (!["opencode", "openclaw"].includes(agent)) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Unknown agent" } });
    const info = await agentInfo(agent as "opencode" | "openclaw", agent === "opencode" ? cfg.opencodeBin : cfg.openclawBin);
    return { agent, startupBehaviour: "manual", workingDirectory: cfg.workspaceRoots[0], port: agent === "opencode" ? 4096 : 18789, endpoint: info.endpoint, hasSecret: false };
  });

  app.post("/api/v1/agents/:agent/config", { preHandler: requirePerm("agents:manage") }, async (req, reply) => {
    const { agent } = req.params as { agent: string };
    if (!["opencode", "openclaw"].includes(agent)) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Unknown agent" } });
    // Secrets are accepted write-only and never stored or returned.
    const body = z.object({ workingDirectory: z.string().optional(), port: z.number().optional(), secret: z.string().optional() }).passthrough().parse(req.body ?? {});
    log("station", "info", `Agent config updated for ${agent} (secret ${body.secret ? "set" : "unchanged"})`);
    return { ok: true, agent };
  });

  // --- Settings ------------------------------------------------------------------------
  app.get("/api/v1/settings", { preHandler: requirePerm("metrics:read") }, async () => ({
    stationName: cfg.stationName, theme: "dark", timeFormat: "24h",
    defaultWorkspace: cfg.workspaceRoots[0], defaultShell: cfg.defaultShell,
    hybridRuntimeMode: true, healthCheckIntervalSec: 15, sessionTimeoutMin: 30,
    remoteAccessEnabled: false,
    notifications: { connectionChanges: true, serviceFailures: true, agentCompletion: false, runtimeInterruptions: true },
  }));

  app.post("/api/v1/settings", { preHandler: requirePerm("connections:manage") }, async () => ({ ok: true }));

  // --- Station control ---------------------------------------------------------------------
  app.post("/api/v1/station/restart", { preHandler: requirePerm("destructive") }, async () => {
    log("station", "warning", "Station restart requested via API");
    setTimeout(() => process.exit(0), 500); // supervisor / start script relaunches
    return { ok: true, message: "Restarting" };
  });

  // Silence unused imports in some builds.
  void getStatus; void agentStart; void agentStop; void agentRestart; void agentLogs;
}
