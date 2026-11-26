import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = mkdtempSync(join(tmpdir(), "fd-api-"));
process.env.FOUNDA_DOCK_HOME = home;
mkdirSync(join(home, "projects"), { recursive: true });
mkdirSync(join(home, "config"), { recursive: true });

const Fastify = (await import("fastify")).default;
const websocket = (await import("@fastify/websocket")).default;
const { registerRoutes } = await import("../src/routes.js");
const auth = await import("../src/security/auth.js");
const { initAgents } = await import("../src/agents/adapters.js");
const { registerService } = await import("../src/services/supervisor.js");

let app: Awaited<ReturnType<typeof Fastify>>;
let token = "";

before(async () => {
  app = Fastify();
  await app.register(websocket);
  registerService({ id: "station-api", name: "Station API", bin: "node", args: ["-e", "setInterval(()=>{},1000)"], cwd: home });
  initAgents("opencode", "openclaw");
  await registerRoutes(app);
  await app.ready();
  // Pair a session the same way the browser does.
  const code = auth.generatePairingCode(300, "test");
  const res = await app.inject({ method: "POST", url: "/api/v1/connections/pair", payload: { code } });
  assert.equal(res.statusCode, 201);
  token = res.json().token;
});

after(async () => { await app.close(); });

const authHeaders = () => ({ authorization: `Bearer ${token}` });

test("health is public", async () => {
  const res = await app.inject({ method: "GET", url: "/api/v1/health" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
});

test("unauthenticated requests are rejected", async () => {
  const res = await app.inject({ method: "GET", url: "/api/v1/station" });
  assert.equal(res.statusCode, 401);
});

test("authenticated station endpoint returns real data", async () => {
  const res = await app.inject({ method: "GET", url: "/api/v1/station", headers: authHeaders() });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.id);
  assert.ok(body.capabilities);
});

test("system metrics are real or explicitly null", async () => {
  const res = await app.inject({ method: "GET", url: "/api/v1/system", headers: authHeaders() });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok("cpuPercent" in body);
});

test("services endpoint reports truthful states", async () => {
  const res = await app.inject({ method: "GET", url: "/api/v1/services", headers: authHeaders() });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body));
  for (const s of body) {
    assert.ok(["running", "stopped", "starting", "stopping", "error", "unknown"].includes(s.status));
  }
});

test("path traversal via files API is rejected", async () => {
  const res = await app.inject({ method: "GET", url: "/api/v1/files?path=/etc", headers: authHeaders() });
  assert.equal(res.statusCode, 400);
});

test("pairing with wrong code fails", async () => {
  const res = await app.inject({ method: "POST", url: "/api/v1/connections/pair", payload: { code: "111111" } });
  assert.equal(res.statusCode, 401);
});

test("revoked session loses access", async () => {
  const sessions = auth.listSessions();
  const target = sessions.find((s) => s.label === "browser");
  assert.ok(target);
  auth.revokeSession(target!.id);
  const res = await app.inject({ method: "GET", url: "/api/v1/station", headers: authHeaders() });
  assert.equal(res.statusCode, 401);
});
