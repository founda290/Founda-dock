import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";

const exec = promisify(execFile);

// ---------------------------------------------------------------------------
// Persistent terminal sessions backed by tmux.
//
// - Each session is a real tmux session named `fd-<id>` running the user's
//   shell. Browser disconnects never kill it.
// - Output is streamed by polling `tmux capture-pane` (simple, robust on
//   Termux; pipe-pane is an optimisation for later).
// - Sessions survive runtime restarts: on boot we re-discover `fd-*` sessions.
// ---------------------------------------------------------------------------

export interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  pid: number | null;
  createdAt: string;
  status: "active" | "exited" | "reconnecting" | "expired";
  exitCode: number | null;
}

const sessions = new Map<string, TerminalSession & { tmuxName: string; lastSeen: string }>();

const tmuxName = (id: string) => `fd-${id}`;

async function tmux(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return exec("tmux", args, { timeout: 10000 });
}

export function tmuxAvailable(): boolean {
  // Synchronous check via PATH scan (avoid spawning on every call).
  const pathEnv = process.env.PATH ?? "";
  return pathEnv.split(":").some((d) => existsSync(`${d}/tmux`));
}

export async function listSessions(): Promise<TerminalSession[]> {
  // Re-discover tmux sessions after a runtime restart.
  try {
    const { stdout } = await tmux(["list-sessions", "-F", "#{session_name}"]);
    for (const name of stdout.trim().split("\n").filter(Boolean)) {
      if (!name.startsWith("fd-")) continue;
      const id = name.slice(3);
      if (!sessions.has(id)) {
        sessions.set(id, {
          id, name: id, cwd: process.env.HOME ?? "~", pid: null,
          createdAt: new Date().toISOString(), status: "active", exitCode: null,
          tmuxName: name, lastSeen: "",
        });
      }
    }
  } catch { /* no tmux server running */ }
  return [...sessions.values()].map(({ tmuxName: _t, lastSeen: _l, ...s }) => s);
}

export async function createSession(cwd: string, shell: string): Promise<TerminalSession> {
  const id = randomBytes(4).toString("hex");
  const name = tmuxName(id);
  await tmux(["new-session", "-d", "-s", name, "-c", cwd, shell]);
  const s: TerminalSession & { tmuxName: string; lastSeen: string } = {
    id, name: id, cwd, pid: null,
    createdAt: new Date().toISOString(), status: "active", exitCode: null,
    tmuxName: name, lastSeen: "",
  };
  sessions.set(id, s);
  return { id, name, cwd, pid: null, createdAt: s.createdAt, status: "active", exitCode: null };
}

export async function getSession(id: string): Promise<TerminalSession | null> {
  const s = sessions.get(id);
  if (!s) return null;
  try {
    await tmux(["has-session", "-t", s.tmuxName]);
    s.status = "active";
  } catch {
    s.status = "exited";
  }
  return { id: s.id, name: s.name, cwd: s.cwd, pid: s.pid, createdAt: s.createdAt, status: s.status, exitCode: s.exitCode };
}

export async function deleteSession(id: string): Promise<boolean> {
  const s = sessions.get(id);
  if (!s) return false;
  try { await tmux(["kill-session", "-t", s.tmuxName]); } catch { /* already gone */ }
  sessions.delete(id);
  return true;
}

export async function sendInput(id: string, data: string): Promise<void> {
  const s = sessions.get(id);
  if (!s) throw new Error("Session not found");
  // -l sends literal keys; Enter is sent as a separate key event.
  if (data === "\r" || data === "\n") {
    await tmux(["send-keys", "-t", s.tmuxName, "Enter"]);
  } else {
    await tmux(["send-keys", "-t", s.tmuxName, "-l", data]);
  }
}

export async function resizeSession(id: string, cols: number, rows: number): Promise<void> {
  const s = sessions.get(id);
  if (!s) return;
  try {
    await tmux(["resize-window", "-t", s.tmuxName, "-x", String(cols), "-y", String(rows)]);
  } catch { /* window may not exist yet */ }
}

// Poll-based output streaming. Returns new pane content since `lastSeen`.
export async function captureOutput(id: string, lastSeen: string): Promise<{ output: string; seen: string; alive: boolean }> {
  const s = sessions.get(id);
  if (!s) return { output: "", seen: lastSeen, alive: false };
  try {
    const { stdout } = await tmux(["capture-pane", "-t", s.tmuxName, "-p", "-S", "-200"]);
    if (stdout === lastSeen) return { output: "", seen: lastSeen, alive: true };
    // Diff: emit only the appended portion when possible.
    let delta = stdout;
    if (lastSeen && stdout.startsWith(lastSeen)) delta = stdout.slice(lastSeen.length);
    return { output: delta, seen: stdout, alive: true };
  } catch {
    return { output: "", seen: lastSeen, alive: false };
  }
}
