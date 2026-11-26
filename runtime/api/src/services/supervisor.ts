import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Lightweight process supervisor.
//
// State machine: STOPPED -> STARTING -> RUNNING -> STOPPING -> STOPPED
//                              \-> FAILED (startup error / crash)
//                              \-> UNAVAILABLE (binary not installed)
//
// Process identity is verified via /proc/<pid>/cmdline (Linux/Termux) so a
// reused PID can never be mistaken for our service. Duplicate instances are
// prevented by the registry: a service can only have one live child.
// ---------------------------------------------------------------------------

export type ServiceState = "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" | "FAILED" | "UNAVAILABLE";

export interface ManagedService {
  id: string;
  name: string;
  bin: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  healthCheck?: () => Promise<boolean>;
}

export interface ServiceStatus {
  id: string;
  name: string;
  state: ServiceState;
  pid: number | null;
  startedAt: string | null;
  lastError: string | null;
  installed: boolean;
}

interface Entry {
  def: ManagedService;
  state: ServiceState;
  child: ChildProcess | null;
  startedAt: string | null;
  lastError: string | null;
  logTail: string[];
}

const registry = new Map<string, Entry>();

export function registerService(def: ManagedService): void {
  if (!registry.has(def.id)) {
    registry.set(def.id, { def, state: "STOPPED", child: null, startedAt: null, lastError: null, logTail: [] });
  }
}

function which(bin: string): boolean {
  // `command -v` via shell is avoided; check PATH manually.
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(":")) {
    if (existsSync(`${dir}/${bin}`)) return true;
  }
  return false;
}

function verifyIdentity(pid: number, expectedBin: string): boolean {
  try {
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ");
    return cmdline.includes(expectedBin);
  } catch {
    // /proc unavailable (non-Linux dev): fall back to "process exists".
    try { process.kill(pid, 0); return true; } catch { return false; }
  }
}

export function getStatus(id: string): ServiceStatus | null {
  const e = registry.get(id);
  if (!e) return null;
  const installed = which(e.def.bin);
  if (!installed && e.state !== "RUNNING") e.state = "UNAVAILABLE";
  return {
    id: e.def.id,
    name: e.def.name,
    state: e.state,
    pid: e.child?.pid ?? null,
    startedAt: e.startedAt,
    lastError: e.lastError,
    installed,
  };
}

export function listStatuses(): ServiceStatus[] {
  return [...registry.keys()].map((id) => getStatus(id)!).filter(Boolean);
}

export function getLogTail(id: string, lines = 50): string[] {
  return registry.get(id)?.logTail.slice(-lines) ?? [];
}

export async function startService(id: string): Promise<ServiceStatus> {
  const e = registry.get(id);
  if (!e) throw new Error(`Unknown service: ${id}`);
  if (e.state === "RUNNING") return getStatus(id)!; // duplicate prevention
  if (!which(e.def.bin)) {
    e.state = "UNAVAILABLE";
    e.lastError = `Binary not found: ${e.def.bin}`;
    return getStatus(id)!;
  }
  e.state = "STARTING";
  e.lastError = null;
  const child = spawn(e.def.bin, e.def.args, {
    cwd: e.def.cwd,
    env: { ...process.env, ...e.def.env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  e.child = child;
  e.startedAt = new Date().toISOString();
  const push = (chunk: Buffer) => {
    e.logTail.push(chunk.toString());
    if (e.logTail.length > 200) e.logTail.splice(0, e.logTail.length - 200);
  };
  child.stdout?.on("data", push);
  child.stderr?.on("data", push);
  child.on("error", (err) => {
    e.state = "FAILED";
    e.lastError = err.message;
    e.child = null;
  });
  child.on("exit", (code, signal) => {
    if (e.child === child) {
      e.child = null;
      if (e.state === "RUNNING" || e.state === "STARTING") {
        e.state = code === 0 ? "STOPPED" : "FAILED";
        e.lastError = code === 0 ? null : `Exited with code ${code ?? signal}`;
      }
    }
  });
  // Give the process a moment to fail fast, then mark RUNNING if still alive.
  await new Promise((r) => setTimeout(r, 800));
  if (e.child && e.child.pid && verifyIdentity(e.child.pid, e.def.bin)) {
    e.state = "RUNNING";
  } else if (e.state === "STARTING") {
    e.state = "FAILED";
    e.lastError = "Process exited during startup — see service logs";
  }
  return getStatus(id)!;
}

export async function stopService(id: string, timeoutMs = 5000): Promise<ServiceStatus> {
  const e = registry.get(id);
  if (!e) throw new Error(`Unknown service: ${id}`);
  if (!e.child?.pid) {
    e.state = "STOPPED";
    return getStatus(id)!;
  }
  e.state = "STOPPING";
  const pid = e.child.pid;
  e.child.kill("SIGTERM");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!verifyIdentity(pid, e.def.bin)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (verifyIdentity(pid, e.def.bin)) {
    try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ }
  }
  e.child = null;
  e.state = "STOPPED";
  return getStatus(id)!;
}

export async function restartService(id: string): Promise<ServiceStatus> {
  await stopService(id);
  return startService(id);
}
