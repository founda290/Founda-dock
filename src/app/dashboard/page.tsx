"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Bot, Cpu, FolderOpen, HardDrive, MemoryStick, Play, Plus, RotateCw, Square, Terminal, Timer } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Badge, Button, Card, EmptyState, ErrorState, OfflineState, Skeleton } from "@/components/ui";
import { formatDate, formatTime, formatUptime } from "@/lib/utils";
import type { ServiceInfo } from "@/lib/types";

function Sparkline({ points }: { points: (number | null)[] }) {
  const vals = points.filter((v): v is number => v != null);
  if (vals.length < 2) return <p className="text-[11px] text-text-3">No history yet</p>;
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const coords = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${28 - ((v - min) / range) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={coords} fill="none" stroke="#00C985" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetricCard({ icon: Icon, label, value, sub, history }: { icon: typeof Cpu; label: string; value: string; sub: string; history?: (number | null)[] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-text-2">{label}</p>
        <Icon className="h-4 w-4 text-text-3" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
      <p className="text-[12px] text-text-3">{sub}</p>
      {history && <div className="mt-3"><Sparkline points={history} /></div>}
    </Card>
  );
}

function ServiceRow({ service }: { service: ServiceInfo }) {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast, askConfirm } = useUi();
  const act = useMutation({
    mutationFn: (action: "start" | "stop" | "restart") =>
      action === "start" ? provider.startService(service.id) : action === "stop" ? provider.stopService(service.id) : provider.restartService(service.id),
    onSuccess: (s) => { toast(`${s.name} ${s.status}`, "success"); qc.invalidateQueries({ queryKey: ["services"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Action failed", "error"),
  });
  const tone = service.status === "running" ? "success" : service.status === "error" ? "error" : service.status === "stopped" ? "neutral" : "warning";
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text">{service.name}</p>
        <p className="font-mono text-[11px] text-text-3">
          {service.pid != null ? `PID ${service.pid}` : "No process"} · up {formatUptime(service.uptimeSeconds)} · checked {formatTime(service.lastHealthCheck)}
        </p>
      </div>
      <Badge tone={tone as "success" | "error" | "neutral" | "warning"}>{service.status}</Badge>
      <div className="flex gap-1">
        {service.supports.start && <Button variant="ghost" disabled={act.isPending || service.status === "running"} onClick={() => act.mutate("start")} title="Start service"><Play className="h-3.5 w-3.5" /></Button>}
        {service.supports.stop && (
          <Button variant="ghost" disabled={act.isPending || service.status === "stopped"} title="Stop service"
            onClick={() => askConfirm(`Stop ${service.name}?`, "This will terminate the process on the Android device.", "Stop", () => act.mutate("stop"))}>
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
        {service.supports.restart && <Button variant="ghost" disabled={act.isPending} onClick={() => act.mutate("restart")} title="Restart service"><RotateCw className="h-3.5 w-3.5" /></Button>}
        {service.supports.logs && <Link href="/logs" className="rounded-md p-1.5 text-text-2 hover:bg-hover hover:text-text" title="View logs"><Activity className="h-3.5 w-3.5" /></Link>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast, askConfirm } = useUi();

  const station = useQuery({ queryKey: ["station"], queryFn: () => provider.getStation(), refetchInterval: 15000 });
  const system = useQuery({ queryKey: ["system"], queryFn: () => provider.getSystem(), refetchInterval: 15000 });
  const services = useQuery({ queryKey: ["services"], queryFn: () => provider.getServices(), refetchInterval: 15000 });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => provider.getActivity() });

  const stationAction = useMutation({
    mutationFn: (a: "start" | "stop" | "restart") =>
      a === "start" ? provider.startStation() : a === "stop" ? provider.stopStation() : provider.restartStation(),
    onSuccess: () => { toast("Station action completed", "success"); qc.invalidateQueries({ queryKey: ["station"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Station action failed", "error"),
  });

  if (station.isError) {
    return <OfflineState body="The Station runtime could not be reached. In mock mode this page shows simulated data; in live mode, pair your Android device to connect." />;
  }

  const s = station.data;
  const m = system.data;
  const disconnected = s?.status === "disconnected" || s?.status === "interrupted";

  return (
    <div className="flex flex-col gap-6">
      {/* Station overview */}
      <Card className="p-5">
        {station.isLoading ? <Skeleton className="h-20" /> : (
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-text">{s?.name}</h2>
                <Badge tone={disconnected ? "error" : "success"}>{s?.status}</Badge>
                {provider.mode === "mock" && <Badge tone="warning">SIMULATED DATA</Badge>}
              </div>
              <p className="mt-1 text-[13px] text-text-2">{s?.deviceName} · {s?.connectionType} connection · {s?.runtimeMode} mode</p>
              <p className="mt-1 font-mono text-[11px] text-text-3">
                uptime {formatUptime(s?.uptimeSeconds ?? null)} · heartbeat {formatTime(s?.lastHeartbeat ?? null)} · v{s?.version} (API {s?.apiVersion})
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" disabled={stationAction.isPending} onClick={() => stationAction.mutate("start")}><Play className="h-3.5 w-3.5" /> Start</Button>
              <Button disabled={stationAction.isPending} onClick={() => askConfirm("Stop Station?", "The browser cannot start an Android service while the phone is disconnected. Stopping will end the current runtime session.", "Stop Station", () => stationAction.mutate("stop"))}><Square className="h-3.5 w-3.5" /> Stop</Button>
              <Button disabled={stationAction.isPending} onClick={() => stationAction.mutate("restart")}><RotateCw className="h-3.5 w-3.5" /> Restart</Button>
            </div>
          </div>
        )}
        {disconnected && (
          <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[12px] text-warning">
            The browser cannot directly start an Android service while the phone is disconnected. Wake the device or pair again from Connections.
          </p>
        )}
      </Card>

      {/* Resources */}
      {system.isLoading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        : system.isError ? <ErrorState title="Metrics unavailable" body="Waiting for device data. The runtime did not return system metrics." onRetry={() => system.refetch()} />
        : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Cpu} label="CPU" value={m?.cpuPercent != null ? `${m.cpuPercent}%` : "Unavailable"} sub="processor usage" history={m?.history.map((p) => p.cpu)} />
            <MetricCard icon={MemoryStick} label="Memory" value={m?.memoryPercent != null ? `${m.memoryPercent}%` : "Unavailable"} sub={m?.memoryUsedMb != null ? `${m.memoryUsedMb} / ${m.memoryTotalMb} MB` : "waiting for device data"} history={m?.history.map((p) => p.mem)} />
            <MetricCard icon={HardDrive} label="Storage" value={m?.storagePercent != null ? `${m.storagePercent}%` : "Unavailable"} sub={m?.storageUsedGb != null ? `${m.storageUsedGb} / ${m.storageTotalGb} GB` : "waiting for device data"} />
            <MetricCard icon={Timer} label="Uptime" value={formatUptime(m?.uptimeSeconds ?? null)} sub="runtime uptime" />
          </div>
        )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Services */}
        <Card>
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Active services</h3></div>
          {services.isLoading ? <div className="p-4"><Skeleton className="h-40" /></div>
            : services.isError ? <div className="p-4"><ErrorState title="Services unavailable" onRetry={() => services.refetch()} /></div>
            : services.data?.map((svc) => <ServiceRow key={svc.id} service={svc} />)}
        </Card>

        {/* Activity + quick actions */}
        <div className="flex flex-col gap-6">
          <Card>
            <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Quick actions</h3></div>
            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
              <Link href="/terminal"><Button className="w-full justify-center"><Plus className="h-3.5 w-3.5" /> New terminal</Button></Link>
              <Link href="/workspaces"><Button className="w-full justify-center"><FolderOpen className="h-3.5 w-3.5" /> Workspaces</Button></Link>
              <Link href="/agents"><Button className="w-full justify-center"><Bot className="h-3.5 w-3.5" /> Agents</Button></Link>
              <Link href="/system"><Button className="w-full justify-center"><Activity className="h-3.5 w-3.5" /> System</Button></Link>
              <Link href="/terminal"><Button className="w-full justify-center"><Terminal className="h-3.5 w-3.5" /> Open terminal</Button></Link>
              <Link href="/connections"><Button className="w-full justify-center"><Plus className="h-3.5 w-3.5" /> Pair device</Button></Link>
            </div>
          </Card>
          <Card>
            <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Recent activity</h3></div>
            {activity.isLoading ? <div className="p-4"><Skeleton className="h-24" /></div>
              : !activity.data?.length ? <div className="p-4"><EmptyState title="No activity yet" body="Events from the Station will appear here." /></div>
              : (
                <ul className="divide-y divide-border">
                  {activity.data.slice(0, 8).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-[13px] text-text-2">{a.message}</span>
                      <span className="shrink-0 font-mono text-[11px] text-text-3">{formatDate(a.ts)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </div>
      </div>
    </div>
  );
}
