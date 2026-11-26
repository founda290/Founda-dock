#!/usr/bin/env node
// Founda Dock Station CLI — run on the device (Termux).
//   node dist/cli.js pair [--label browser]   Generate a pairing code
//   node dist/cli.js sessions                 List paired sessions
//   node dist/cli.js revoke <id>              Revoke a session
//   node dist/cli.js status                   Print station status
import { loadConfig } from "./config.js";
import { generatePairingCode, listSessions, revokeSession } from "./security/auth.js";
import { collectMetrics, deviceInfo } from "./monitoring/system.js";

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "pair": {
    const labelIdx = rest.indexOf("--label");
    const label = labelIdx >= 0 ? rest[labelIdx + 1] ?? "browser" : "browser";
    const cfg = loadConfig();
    const code = generatePairingCode(cfg.pairingTtlSeconds, label);
    console.log(`\nPairing code (valid ${cfg.pairingTtlSeconds}s, single-use):\n`);
    console.log(`  ${code}\n`);
    console.log("Enter this code in Founda Dock → Connections → Pair a browser.");
    break;
  }
  case "sessions": {
    const sessions = listSessions();
    if (!sessions.length) { console.log("No active sessions."); break; }
    for (const s of sessions) {
      console.log(`${s.id}  ${s.label}  expires ${new Date(s.expiresAt).toISOString()}`);
    }
    break;
  }
  case "revoke": {
    const id = rest[0];
    if (!id) { console.error("Usage: node dist/cli.js revoke <session-id>"); process.exit(1); }
    console.log(revokeSession(id) ? `Revoked ${id}` : `Session ${id} not found`);
    break;
  }
  case "status": {
    const m = collectMetrics();
    const d = deviceInfo();
    console.log(JSON.stringify({ device: d, metrics: { cpu: m.cpuPercent, mem: m.memoryPercent, uptime: m.uptimeSeconds } }, null, 2));
    break;
  }
  default:
    console.log("Usage: node dist/cli.js <pair|sessions|revoke|status>");
    process.exit(1);
}
