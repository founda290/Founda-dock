import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { registerService, getStatus, startService, stopService, restartService, getLogTail } from "../services/supervisor.js";
import { dataDir } from "../config.js";
import { join } from "node:path";

const exec = promisify(execFile);

// ---------------------------------------------------------------------------
// OpenCode and OpenClaw adapters. Each owns its lifecycle independently via
// the supervisor. Detection reports truthfully: if the binary is missing the
// service is UNAVAILABLE (never "running" by assumption).
// ---------------------------------------------------------------------------

async function detectVersion(bin: string): Promise<string | null> {
  try {
    const { stdout } = await exec(bin, ["--version"], { timeout: 5000 });
    return stdout.trim().split("\n")[0] ?? null;
  } catch {
    return null;
  }
}

export interface AgentInfo {
  id: string;
  name: string;
  installed: boolean;
  version: string | null;
  state: string;
  pid: number | null;
  endpoint: string | null;
  startedAt: string | null;
  lastError: string | null;
}

export function initAgents(opencodeBin: string, openclawBin: string): void {
  const home = dataDir();
  registerService({
    id: "opencode",
    name: "OpenCode",
    bin: opencodeBin,
    args: ["serve", "--port", "4096"],
    cwd: join(home, "projects"),
    env: { OPENCODE_PORT: "4096" },
  });
  registerService({
    id: "openclaw",
    name: "OpenClaw",
    bin: openclawBin,
    args: ["gateway", "start"],
    cwd: join(home, "projects"),
  });
}

export async function agentInfo(id: "opencode" | "openclaw", bin: string): Promise<AgentInfo> {
  const status = getStatus(id);
  const version = await detectVersion(bin);
  const endpoint = id === "opencode" ? "http://127.0.0.1:4096" : "http://127.0.0.1:18789";
  return {
    id,
    name: id === "opencode" ? "OpenCode" : "OpenClaw",
    installed: version != null,
    version,
    state: status?.state ?? "UNAVAILABLE",
    pid: status?.pid ?? null,
    endpoint: status?.state === "RUNNING" ? endpoint : null,
    startedAt: status?.startedAt ?? null,
    lastError: status?.lastError ?? null,
  };
}

export const agentStart = (id: string) => startService(id);
export const agentStop = (id: string) => stopService(id);
export const agentRestart = (id: string) => restartService(id);
export const agentLogs = (id: string) => getLogTail(id);
