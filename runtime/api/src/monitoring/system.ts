import { readFileSync, statfsSync } from "node:fs";
import { homedir, platform, arch, release } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Real device metrics from /proc (Linux/Termux). Every field is nullable:
// missing data is reported as null (unavailable), NEVER as zero.
// ---------------------------------------------------------------------------

export interface SystemMetrics {
  cpuPercent: number | null;
  memoryPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  storagePercent: number | null;
  storageUsedGb: number | null;
  storageTotalGb: number | null;
  uptimeSeconds: number | null;
  history: { t: string; cpu: number | null; mem: number | null }[];
}

let prevCpu: { idle: number; total: number } | null = null;
const history: SystemMetrics["history"] = [];

function readCpu(): { idle: number; total: number } | null {
  try {
    const line = readFileSync("/proc/stat", "utf8").split("\n")[0];
    const parts = line.split(/\s+/).slice(1).map(Number);
    const idle = parts[3] + (parts[4] ?? 0);
    const total = parts.reduce((a, b) => a + b, 0);
    return { idle, total };
  } catch {
    return null;
  }
}

function readMem(): { usedMb: number; totalMb: number; percent: number } | null {
  try {
    const info = readFileSync("/proc/meminfo", "utf8");
    const total = Number(info.match(/MemTotal:\s+(\d+)/)?.[1] ?? 0) / 1024;
    const avail = Number(info.match(/MemAvailable:\s+(\d+)/)?.[1] ?? 0) / 1024;
    if (!total) return null;
    const used = total - avail;
    return { usedMb: Math.round(used), totalMb: Math.round(total), percent: Math.round((used / total) * 100) };
  } catch {
    return null;
  }
}

function readDisk(): { usedGb: number; totalGb: number; percent: number } | null {
  try {
    const s = statfsSync(homedir());
    const totalGb = (s.bsize * s.blocks) / 1e9;
    const usedGb = totalGb - (s.bsize * s.bfree) / 1e9;
    return { usedGb: Math.round(usedGb * 10) / 10, totalGb: Math.round(totalGb * 10) / 10, percent: Math.round((usedGb / totalGb) * 100) };
  } catch {
    return null;
  }
}

function readUptime(): number | null {
  try {
    return Math.floor(Number(readFileSync("/proc/uptime", "utf8").split(/\s+/)[0]));
  } catch {
    return null;
  }
}

export function collectMetrics(): SystemMetrics {
  const cpuNow = readCpu();
  let cpuPercent: number | null = null;
  if (cpuNow && prevCpu) {
    const dTotal = cpuNow.total - prevCpu.total;
    const dIdle = cpuNow.idle - prevCpu.idle;
    if (dTotal > 0) cpuPercent = Math.round((1 - dIdle / dTotal) * 100);
  }
  if (cpuNow) prevCpu = cpuNow;

  const mem = readMem();
  const disk = readDisk();
  const uptime = readUptime();

  history.push({ t: new Date().toISOString(), cpu: cpuPercent, mem: mem?.percent ?? null });
  if (history.length > 120) history.shift();

  return {
    cpuPercent,
    memoryPercent: mem?.percent ?? null,
    memoryUsedMb: mem?.usedMb ?? null,
    memoryTotalMb: mem?.totalMb ?? null,
    storagePercent: disk?.percent ?? null,
    storageUsedGb: disk?.usedGb ?? null,
    storageTotalGb: disk?.totalGb ?? null,
    uptimeSeconds: uptime,
    history: [...history],
  };
}

export function deviceInfo(): Record<string, string | number | null> {
  let androidVersion: string | null = null;
  try {
    const prop = readFileSync("/system/build.prop", "utf8");
    androidVersion = prop.match(/ro\.build\.version\.release=(\S+)/)?.[1] ?? null;
  } catch { /* not Android */ }
  let nodeVersion: string | null = null;
  try { nodeVersion = process.version; } catch { /* noop */ }
  let termuxVersion: string | null = null;
  try {
    termuxVersion = readFileSync(join(homedir(), ".termux", "termux.properties"), "utf8").slice(0, 200) || null;
  } catch { /* not Termux */ }
  return {
    deviceName: process.env.HOSTNAME ?? "Android Device",
    androidVersion,
    architecture: arch(),
    kernel: `${platform()} ${release()}`,
    termuxVersion,
    nodeVersion,
    storageAvailableGb: readDisk()?.totalGb ?? null,
  };
}
