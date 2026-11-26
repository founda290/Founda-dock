import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync, statSync, readFileSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { resolveWithinRoots, isProtectedPath, PathError } from "../security/paths.js";
import { dataDir } from "../config.js";

const exec = promisify(execFile);

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  sizeBytes: number | null;
  modifiedAt: string;
  extension: string | null;
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

function guard(absPath: string): void {
  if (isProtectedPath(absPath, dataDir())) throw new PathError("Path is protected");
}

export function listDir(requested: string, roots: string[]): FileEntry[] {
  const abs = resolveWithinRoots(requested, roots);
  guard(abs);
  const entries = readdirSync(abs, { withFileTypes: true });
  return entries
    .map((e) => {
      const full = join(abs, e.name);
      let size: number | null = null;
      let mtime = "";
      try {
        const st = statSync(full);
        size = e.isFile() ? st.size : null;
        mtime = st.mtime.toISOString();
      } catch { /* unreadable entry */ }
      return {
        name: e.name,
        path: full,
        type: (e.isDirectory() ? "dir" : "file") as "file" | "dir",
        sizeBytes: size,
        modifiedAt: mtime,
        extension: e.isFile() && e.name.includes(".") ? e.name.split(".").pop() ?? null : null,
      };
    })
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
}

const MAX_PREVIEW = 256 * 1024;

export function readTextFile(requested: string, roots: string[]): { content: string; truncated: boolean } {
  const abs = resolveWithinRoots(requested, roots);
  guard(abs);
  const st = statSync(abs);
  if (!st.isFile()) throw new PathError("Not a file");
  const buf = readFileSync(abs);
  const truncated = buf.length > MAX_PREVIEW;
  return { content: buf.subarray(0, MAX_PREVIEW).toString("utf8"), truncated };
}

export function createFolder(parent: string, name: string, roots: string[]): FileEntry {
  if (!name || name.includes("/") || name.includes("\0")) throw new PathError("Invalid folder name");
  const abs = resolveWithinRoots(join(parent, name), roots);
  guard(abs);
  mkdirSync(abs, { recursive: false });
  return { name, path: abs, type: "dir", sizeBytes: null, modifiedAt: new Date().toISOString(), extension: null };
}

export function renamePath(requested: string, newName: string, roots: string[]): FileEntry {
  if (!newName || newName.includes("/") || newName.includes("\0")) throw new PathError("Invalid name");
  const abs = resolveWithinRoots(requested, roots);
  guard(abs);
  const dest = join(dirname(abs), newName);
  resolveWithinRoots(dest, roots);
  renameSync(abs, dest);
  const st = statSync(dest);
  return { name: newName, path: dest, type: st.isDirectory() ? "dir" : "file", sizeBytes: st.isFile() ? st.size : null, modifiedAt: st.mtime.toISOString(), extension: null };
}

export function deletePath(requested: string, roots: string[]): void {
  const abs = resolveWithinRoots(requested, roots);
  guard(abs);
  rmSync(abs, { recursive: true, force: false });
}

export function writeUpload(parent: string, filename: string, data: Buffer, roots: string[]): FileEntry {
  if (!filename || filename.includes("/") || filename.includes("\0")) throw new PathError("Invalid filename");
  const abs = resolveWithinRoots(join(parent, filename), roots);
  guard(abs);
  writeFileSync(abs, data);
  return { name: filename, path: abs, type: "file", sizeBytes: data.length, modifiedAt: new Date().toISOString(), extension: filename.split(".").pop() ?? null };
}

// --- Workspaces --------------------------------------------------------------

export async function listWorkspaces(roots: string[]): Promise<Workspace[]> {
  const out: Workspace[] = [];
  for (const root of roots) {
    let entries: string[] = [];
    try { entries = readdirSync(root); } catch { continue; }
    for (const name of entries) {
      const full = join(root, name);
      try {
        if (!statSync(full).isDirectory()) continue;
      } catch { continue; }
      out.push(await describeWorkspace(full));
    }
  }
  return out;
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, timeout: 10000 });
  return stdout.trim();
}

export async function describeWorkspace(full: string): Promise<Workspace> {
  const name = basename(full);
  let gitBranch: string | null = null;
  let gitStatus: Workspace["gitStatus"] = "not-a-repo";
  let lastCommit: string | null = null;
  try {
    gitBranch = await git(["rev-parse", "--abbrev-ref", "HEAD"], full);
    const status = await git(["status", "--porcelain"], full);
    gitStatus = status.length ? "dirty" : "clean";
    lastCommit = await git(["log", "-1", "--format=%h %s"], full).catch(() => null);
  } catch { /* not a repo */ }
  let lastModified = new Date().toISOString();
  try { lastModified = statSync(full).mtime.toISOString(); } catch { /* noop */ }
  return { id: name, name, path: full, type: "Project", gitBranch, gitStatus, lastModified, lastCommit };
}

export async function gitAction(path: string, action: "pull" | "push" | "status"): Promise<Workspace> {
  if (action === "pull") await git(["pull"], path);
  if (action === "push") await git(["push"], path);
  return describeWorkspace(path);
}

export async function cloneRepo(url: string, dest: string, roots: string[]): Promise<Workspace> {
  if (!/^https?:\/\//.test(url)) throw new PathError("Only http(s) clone URLs are allowed");
  const abs = resolveWithinRoots(dest, roots);
  guard(abs);
  await exec("git", ["clone", url, abs], { timeout: 120000 });
  return describeWorkspace(abs);
}
