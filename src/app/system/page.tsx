"use client";
import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, MemoryStick, Wifi } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { Badge, Card, ErrorState, Skeleton } from "@/components/ui";
import { formatUptime } from "@/lib/utils";

function Bar({ pct }: { pct: number | null }) {
  if (pct == null) return <p className="text-[12px] text-text-3">Unavailable</p>;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function SystemPage() {
  const provider = useStation();
  const system = useQuery({ queryKey: ["system"], queryFn: () => provider.getSystem(), refetchInterval: 15000 });
  const services = useQuery({ queryKey: ["services"], queryFn: () => provider.getServices(), refetchInterval: 15000 });
  const m = system.data;

  return (
    <div className="flex flex-col gap-6">
      {system.isLoading ? <Skeleton className="h-64" />
        : system.isError ? <ErrorState title="System metrics unavailable" body="Waiting for device data — the runtime did not return metrics. Unavailable is shown explicitly, never as zero." onRetry={() => system.refetch()} />
        : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-text-2"><Cpu className="h-4 w-4" /><span className="text-[12px]">CPU</span></div>
              <p className="mt-2 text-2xl font-semibold text-text">{m?.cpuPercent != null ? `${m.cpuPercent}%` : "—"}</p>
              <div className="mt-2"><Bar pct={m?.cpuPercent ?? null} /></div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-text-2"><MemoryStick className="h-4 w-4" /><span className="text-[12px]">Memory</span></div>
              <p className="mt-2 text-2xl font-semibold text-text">{m?.memoryPercent != null ? `${m.memoryPercent}%` : "—"}</p>
              <p className="text-[11px] text-text-3">{m?.memoryUsedMb != null ? `${m.memoryUsedMb} / ${m.memoryTotalMb} MB` : "Unavailable"}</p>
              <div className="mt-2"><Bar pct={m?.memoryPercent ?? null} /></div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-text-2"><HardDrive className="h-4 w-4" /><span className="text-[12px]">Disk</span></div>
              <p className="mt-2 text-2xl font-semibold text-text">{m?.storagePercent != null ? `${m.storagePercent}%` : "—"}</p>
              <p className="text-[11px] text-text-3">{m?.storageUsedGb != null ? `${m.storageUsedGb} / ${m.storageTotalGb} GB` : "Unavailable"}</p>
              <div className="mt-2"><Bar pct={m?.storagePercent ?? null} /></div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-text-2"><Wifi className="h-4 w-4" /><span className="text-[12px]">Uptime</span></div>
              <p className="mt-2 text-2xl font-semibold text-text">{formatUptime(m?.uptimeSeconds ?? null)}</p>
              <p className="text-[11px] text-text-3">runtime uptime</p>
            </Card>
          </div>
        )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Runtime health</h3></div>
          {services.isLoading ? <div className="p-4"><Skeleton className="h-32" /></div>
            : (
              <ul className="divide-y divide-border">
                {services.data?.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                    <span className="text-text-2">{s.name}</span>
                    <Badge tone={s.status === "running" ? "success" : s.status === "error" ? "error" : "neutral"}>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text">Device information</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            Device details (Android version, architecture, kernel, Termux and Node versions) are reported by the runtime
            via <span className="font-mono text-[12px]">GET /api/v1/system</span>. When the runtime is unreachable this
            panel stays empty rather than showing fabricated values.
          </p>
          <p className="mt-2 text-[12px] text-text-3">Charts only render when historical data exists.</p>
        </Card>
      </div>
    </div>
  );
}
