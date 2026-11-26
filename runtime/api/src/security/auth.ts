import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../config.js";

// ---------------------------------------------------------------------------
// Pairing + session authentication.
//
// - Pairing codes: 6-digit, single-use, short-lived, stored ONLY as SHA-256
//   hashes. Generated on the device (CLI / API) and entered in the browser.
// - Session tokens: 32 random bytes, returned once at pairing, stored only as
//   hashes in <dataDir>/data/auth.json (mode 0600). Revocable, expirable.
// - Permissions: every session carries an explicit permission set; the runtime
//   enforces it per-route. A valid session is NOT unrestricted access.
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  "metrics:read",
  "workspaces:read",
  "files:read",
  "files:write",
  "terminal:create",
  "terminal:exec",
  "agents:manage",
  "connections:manage",
  "destructive",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const FULL_PERMISSIONS: Permission[] = [...PERMISSIONS];

interface PairingCode {
  hash: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  label: string;
}

interface Session {
  id: string;
  tokenHash: string;
  label: string;
  permissions: Permission[];
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
}

interface AuthStore {
  pairingCodes: PairingCode[];
  sessions: Session[];
  // Rate limiting: ip -> { count, windowStart }
  attempts: Record<string, { count: number; windowStart: number }>;
}

const storePath = () => join(dataDir(), "data", "auth.json");

function load(): AuthStore {
  const p = storePath();
  if (!existsSync(p)) return { pairingCodes: [], sessions: [], attempts: {} };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as AuthStore;
  } catch {
    return { pairingCodes: [], sessions: [], attempts: {} };
  }
}

function save(store: AuthStore): void {
  mkdirSync(join(dataDir(), "data"), { recursive: true });
  writeFileSync(storePath(), JSON.stringify(store, null, 2), { mode: 0o600 });
}

export const hashSecret = (s: string) => createHash("sha256").update(s).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// --- Pairing codes ---------------------------------------------------------

export function generatePairingCode(ttlSeconds: number, label = "browser"): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const store = load();
  const now = Date.now();
  store.pairingCodes = store.pairingCodes.filter((c) => c.expiresAt > now && !c.used);
  store.pairingCodes.push({
    hash: hashSecret(code),
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
    used: false,
    label,
  });
  save(store);
  return code;
}

export function checkPairingRateLimit(ip: string, maxAttempts: number, windowSeconds: number): boolean {
  const store = load();
  const now = Date.now();
  const rec = store.attempts[ip];
  if (!rec || now - rec.windowStart > windowSeconds * 1000) {
    store.attempts[ip] = { count: 1, windowStart: now };
    save(store);
    return true;
  }
  rec.count += 1;
  save(store);
  return rec.count <= maxAttempts;
}

export function consumePairingCode(code: string): boolean {
  const store = load();
  const now = Date.now();
  const entry = store.pairingCodes.find((c) => !c.used && c.expiresAt > now && safeEqual(c.hash, hashSecret(code)));
  if (!entry) return false;
  entry.used = true;
  save(store);
  return true;
}

// --- Session tokens --------------------------------------------------------

export interface SessionInfo {
  id: string;
  label: string;
  permissions: Permission[];
  createdAt: number;
  expiresAt: number;
}

export function createSession(label: string, permissions: Permission[], ttlHours: number): { token: string; session: SessionInfo } {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const session: Session = {
    id: randomBytes(8).toString("hex"),
    tokenHash: hashSecret(token),
    label,
    permissions,
    createdAt: now,
    expiresAt: now + ttlHours * 3600 * 1000,
    revoked: false,
  };
  const store = load();
  store.sessions.push(session);
  save(store);
  return { token, session: toInfo(session) };
}

function toInfo(s: Session): SessionInfo {
  return { id: s.id, label: s.label, permissions: s.permissions, createdAt: s.createdAt, expiresAt: s.expiresAt };
}

export function verifySession(token: string): SessionInfo | null {
  if (!token) return null;
  const store = load();
  const now = Date.now();
  const s = store.sessions.find((x) => !x.revoked && x.expiresAt > now && safeEqual(x.tokenHash, hashSecret(token)));
  return s ? toInfo(s) : null;
}

export function hasPermission(session: SessionInfo, perm: Permission): boolean {
  return session.permissions.includes(perm);
}

export function revokeSession(id: string): boolean {
  const store = load();
  const s = store.sessions.find((x) => x.id === id);
  if (!s) return false;
  s.revoked = true;
  save(store);
  return true;
}

export function listSessions(): SessionInfo[] {
  const now = Date.now();
  return load().sessions.filter((s) => !s.revoked && s.expiresAt > now).map(toInfo);
}

export function extractToken(req: { headers: Record<string, string | string[] | undefined> }): string {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.headers["cookie"];
  if (typeof cookie === "string") {
    const m = cookie.match(/(?:^|;\s*)fd_session=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return "";
}
