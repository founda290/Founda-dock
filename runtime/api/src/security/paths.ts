import { existsSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

// ---------------------------------------------------------------------------
// Filesystem boundary enforcement. Every browser-supplied path is canonicalised
// and checked against the permitted workspace roots. Symlinks are resolved
// before the check so a symlink cannot escape the boundary. Configuration and
// secret directories are always protected.
// ---------------------------------------------------------------------------

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathError";
  }
}

function canonical(p: string): string {
  const abs = resolve(p);
  // Resolve symlinks for the longest existing prefix so non-existent leaf
  // paths (e.g. a new folder) still get a canonical parent check.
  let cur = abs;
  const suffix: string[] = [];
  while (!existsSync(cur)) {
    const parent = resolve(cur, "..");
    if (parent === cur) break;
    suffix.unshift(cur.slice(parent.length + 1));
    cur = parent;
  }
  try {
    cur = realpathSync(cur);
  } catch {
    cur = resolve(cur);
  }
  return suffix.length ? resolve(cur, ...suffix) : cur;
}

export function isWithin(child: string, parent: string): boolean {
  const c = canonical(child);
  const p = canonical(parent);
  return c === p || c.startsWith(p + sep);
}

export function resolveWithinRoots(requested: string, roots: string[]): string {
  if (!requested || requested.includes("\0")) throw new PathError("Invalid path");
  const abs = canonical(requested);
  const ok = roots.some((r) => isWithin(abs, r));
  if (!ok) throw new PathError("Path is outside permitted workspace directories");
  return abs;
}

export function isProtectedPath(absPath: string, dataDir: string): boolean {
  // Never expose config, auth data, backups or logs through the file API.
  const protectedDirs = ["config", "data", "backups", "logs", "runtime"];
  return protectedDirs.some((d) => isWithin(absPath, resolve(dataDir, d)));
}
