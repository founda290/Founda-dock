import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { loadConfig, ensureDirs } from "./config.js";
import { registerRoutes } from "./routes.js";
import { handleSocket, broadcast } from "./websocket/hub.js";
import { initAgents } from "./agents/adapters.js";
import { collectMetrics } from "./monitoring/system.js";
import { registerService } from "./services/supervisor.js";
import { join } from "node:path";
import { dataDir } from "./config.js";

// ---------------------------------------------------------------------------
// Founda Dock Station runtime — entry point.
// Binds 127.0.0.1 by default. LAN binding requires explicit config and every
// request still requires a paired session token.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  ensureDirs();
  const cfg = loadConfig();

  const app = Fastify({ logger: { level: "warn" }, bodyLimit: 10 * 1024 * 1024 });

  await app.register(websocket);

  // Register built-in services with the supervisor.
  registerService({ id: "station-api", name: "Station API", bin: "node", args: [join(dataDir(), "runtime", "api", "dist", "server.js")], cwd: dataDir() });
  registerService({ id: "terminal-engine", name: "Terminal Engine", bin: "tmux", args: ["-V"], cwd: dataDir() });
  registerService({ id: "tunnel", name: "Connection Tunnel", bin: "cloudflared", args: ["tunnel", "run"], cwd: dataDir() });
  initAgents(cfg.opencodeBin, cfg.openclawBin);

  await registerRoutes(app);

  app.get("/api/v1/events", { websocket: true }, (socket) => {
    handleSocket(socket as never, cfg.maxWsConnections);
  });

  // Background metrics broadcast (only when clients are connected).
  if (cfg.metricsIntervalMs > 0) {
    setInterval(() => {
      broadcast("station.metrics", { metrics: collectMetrics() });
      broadcast("station.heartbeat", { ok: true });
    }, cfg.metricsIntervalMs).unref();
  }

  await app.listen({ host: cfg.host, port: cfg.port });
  console.log(`Founda Dock Station API listening on http://${cfg.host}:${cfg.port}`);
  console.log(`Workspace roots: ${cfg.workspaceRoots.join(", ")}`);
  console.log("Generate a pairing code with: node dist/cli.js pair");
}

main().catch((err) => {
  console.error("Station runtime failed to start:", err);
  process.exit(1);
});
