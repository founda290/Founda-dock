import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate the auth store to a temp dir BEFORE importing the module.
process.env.FOUNDA_DOCK_HOME = mkdtempSync(join(tmpdir(), "fd-auth-"));

const auth = await import("../src/security/auth.js");

test("pairing code is single-use", () => {
  const code = auth.generatePairingCode(300, "test");
  assert.equal(auth.consumePairingCode(code), true);
  assert.equal(auth.consumePairingCode(code), false, "second use must fail");
});

test("invalid pairing code is rejected", () => {
  assert.equal(auth.consumePairingCode("000000"), false);
});

test("session token verifies and can be revoked", () => {
  const { token, session } = auth.createSession("test-browser", auth.FULL_PERMISSIONS, 1);
  const verified = auth.verifySession(token);
  assert.ok(verified, "token should verify");
  assert.equal(verified!.label, "test-browser");
  assert.equal(auth.revokeSession(session.id), true);
  assert.equal(auth.verifySession(token), null, "revoked token must not verify");
});

test("permissions are enforced per session", () => {
  const { token } = auth.createSession("reader", ["metrics:read"], 1);
  const s = auth.verifySession(token)!;
  assert.equal(auth.hasPermission(s, "metrics:read"), true);
  assert.equal(auth.hasPermission(s, "destructive"), false);
});

test("pairing rate limit trips after max attempts", () => {
  const ip = "203.0.113.7";
  let allowed = 0;
  for (let i = 0; i < 10; i++) {
    if (auth.checkPairingRateLimit(ip, 3, 600)) allowed++;
  }
  assert.equal(allowed, 3, "only 3 attempts allowed in window");
});
