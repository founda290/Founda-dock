"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Play, RotateCw, Square } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { formatTime, formatUptime } from "@/lib/utils";
import type { AgentConfig, ServiceInfo } from "@/lib/types";

function AgentCard({ service, kind }: { service: ServiceInfo; kind: "opencode" | "openclaw" }) {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast, askConfirm } = useUi();
  const [cfg, setCfg] = useState<AgentConfig | null>(null);
  const [secret, setSecret] = useState("");
  const [showCfg, setShowCfg] = useState(false);

  const act = useMutation({
    mutationFn: (a: "start" | "stop" | "restart") =>
      a === "start" ? provider.startService(service.id) : a === "stop" ? provider.stopService(service.id) : provider.restartService(service.id),
    onSuccess: (s) => { toast(`${s.name} ${s.status}`, "success"); qc.invalidateQueries({ queryKey: ["services"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Action failed", "error"),
  });
  const saveCfg = useMutation({
    mutationFn: () => provider.saveAgentConfig(cfg!, secret || undefined),
    onSuccess: () => { toast("Agent configuration saved", "success"); setSecret(""); },
    onError: (e) => toast(e instanceof Error ? e.message : "Save failed", "error"),
  });

  const loadCfg = async () => {
    const c = await provider.getAgentConfig(kind);
    setCfg(c);
    setShowCfg(true);
  };

  const tone = service.status === "running" ? "success" : service.status === "error" ? "error" : service.status === "stopped" ? "neutral" : "warning";

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent-bright"><Bot className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text">{service.name}</h3>
            <Badge tone={tone as "success" | "error" | "neutral" | "warning"}>{service.status}</Badge>
            {service.version && <span className="font-mono text-[11px] text-text-3">v{service.version}</span>}
          </div>
          <p className="mt-1 font-mono text-[11px] text-text-3">
            {service.pid != null ? `PID ${service.pid}` : "No process"} · up {formatUptime(service.uptimeSeconds)} · checked {formatTime(service.lastHealthCheck)}
          </p>
          {service.endpoint && <p className="mt-0.5 font-mono text-[11px] text-text-3">endpoint: {service.endpoint}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={act.isPending || service.status === "running"} onClick={() => act.mutate("start")}><Play className="h-3.5 w-3.5" /> Start</Button>
        <Button disabled={act.isPending || service.status === "stopped"} onClick={() => askConfirm(`Stop ${service.name}?`, "This stops the agent process on the device.", "Stop", () => act.mutate("stop"))}><Square className="h-3.5 w-3.5" /> Stop</Button>
        <Button disabled={act.isPending} onClick={() => act.mutate("restart")}><RotateCw className="h-3.5 w-3.5" /> Restart</Button>
        <Button variant="ghost" onClick={loadCfg}>Configure</Button>
      </div>

      {showCfg && cfg && (
        <div className="mt-4 space-y-3 rounded-md border border-border bg-surface p-4">
          <label className="block text-[12px] text-text-2">Startup behaviour
            <select value={cfg.startupBehaviour} onChange={(e) => setCfg({ ...cfg, startupBehaviour: e.target.value as AgentConfig["startupBehaviour"] })} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-text">
              <option value="manual">Manual</option><option value="auto">Auto on station start</option>
            </select>
          </label>
          <label className="block text-[12px] text-text-2">Working directory
            <input value={cfg.workingDirectory} onChange={(e) => setCfg({ ...cfg, workingDirectory: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-text" />
          </label>
          <label className="block text-[12px] text-text-2">Port
            <input type="number" value={cfg.port ?? ""} onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value) || null })} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-text" />
          </label>
          <label className="block text-[12px] text-text-2">
            {cfg.hasSecret ? "API key (set — leave blank to keep)" : "API key (write-only, never displayed)"}
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="••••••••" className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-text" />
          </label>
          <div className="flex gap-2">
            <Button variant="primary" disabled={saveCfg.isPending} onClick={() => saveCfg.mutate()}>Save</Button>
            <Button variant="ghost" onClick={() => setShowCfg(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function AgentsPage() {
  const provider = useStation();
  const services = useQuery({ queryKey: ["services"], queryFn: () => provider.getServices(), refetchInterval: 15000 });
  const opencode = services.data?.find((s) => s.id === "opencode");
  const openclaw = services.data?.find((s) => s.id === "openclaw");

  if (services.isLoading) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  if (services.isError) return <ErrorState title="Agent status unavailable" body="Could not reach the runtime. Agents cannot be managed while the Station is offline." onRetry={() => services.refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-[13px] text-text-2">
        OpenCode and OpenClaw are managed as separate services with independent adapters. This page orchestrates the agents —
        it is not an AI chat interface.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {opencode && <AgentCard service={opencode} kind="opencode" />}
        {openclaw && <AgentCard service={openclaw} kind="openclaw" />}
      </div>
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text">Agent processes</h3>
        <p className="mt-1 text-[12px] text-text-2">
          {opencode?.status === "running" || openclaw?.status === "running"
            ? "Live process details (PID, uptime, health) are shown on each card above. CPU/memory per-process metrics appear here when the runtime provides them."
            : "No agent processes are currently running."}
        </p>
      </Card>
    </div>
  );
}
