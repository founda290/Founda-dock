import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "fd-paths-"));
const projects = join(root, "projects");
mkdirSync(projects, { recursive: true });
writeFileSync(join(projects, "hello.txt"), "hi");
mkdirSync(join(root, "outside"), { recursive: true });
symlinkSync(join(root, "outside"), join(projects, "escape"));

const paths = await import("../src/security/paths.js");

test("path inside root is accepted", () => {
  const abs = paths.resolveWithinRoots(join(projects, "hello.txt"), [projects]);
  assert.ok(abs.endsWith("hello.txt"));
});

test("directory traversal is rejected", () => {
  assert.throws(() => paths.resolveWithinRoots(join(projects, "..", "outside"), [projects]), paths.PathError);
  assert.throws(() => paths.resolveWithinRoots("/etc/passwd", [projects]), paths.PathError);
});

test("symlink escape is rejected", () => {
  assert.throws(() => paths.resolveWithinRoots(join(projects, "escape", "secret"), [projects]), paths.PathError);
});

test("protected directories are detected", () => {
  assert.equal(paths.isProtectedPath(join(root, "config", "config.json"), root), true);
  assert.equal(paths.isProtectedPath(join(projects, "hello.txt"), root), false);
});
