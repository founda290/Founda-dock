"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, Pause, Play, Search } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { formatTime } from "@/lib/utils";
import type { LogCategory, LogSeverity } from "@/lib/types";

const CATEGORIES: LogCategory[] = ["station", "terminal", "opencode", "openclaw", "connections", "system"];
const SEVERITIES: LogSeverity[] = ["debug", "info", "warning", "error", "critical"];

const SEV_TONE: Record<LogSeverity, "neutral" | "info" | "warning" | "error"> = {
  debug: "neutral", info: "info", warning: "warning", error: "error", critical: "error",
};

export default function LogsPage() {
  const provider = useStation();
  const { toast } = useUi();
  const [category, setCategory] = useState<LogCategory | "all">("all");
  const [severity, setSeverity] = useState<LogSeverity | "all">("all");
  const [q, setQ] = useState("");
  const [paused, setPaused] = useState(false);

  const logs = useQuery({
    queryKey: ["logs", category, severity, q],
    queryFn: () => provider.getLogs(category === "all" ? undefined : category, severity === "all" ? undefined : severity, q || undefined),
    refetchInterval: paused ? false : 10000,
  });

  const text = useMemo(() => (logs.data ?? []).map((l) => `[${l.ts}] [${l.category}] [${l.severity}] ${l.message}`).join("\n"), [logs.data]);

  const copy = async () => { await navigator.clipboard.writeText(text); toast("Logs copied", "success"); };
  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "founda-dock-logs.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value as LogCategory | "all")} className="rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as LogSeverity | "all")} className="rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text">
          <option value="all">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-text-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search logs" className="w-48 rounded-md border border-border bg-surface py-1.5 pl-8 pr-2 text-[13px] text-text placeholder:text-text-3" />
        </div>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" onClick={() => setPaused((p) => !p)} title={paused ? "Resume auto-refresh" : "Pause auto-refresh"}>{paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</Button>
          <Button variant="ghost" onClick={copy} title="Copy logs"><Copy className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" onClick={download} title="Download logs"><Download className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <Card>
        {logs.isLoading ? <div className="p-4"><Skeleton className="h-64" /></div>
          : logs.isError ? <div className="p-4"><ErrorState title="Logs unavailable" body="The runtime did not return log data." onRetry={() => logs.refetch()} /></div>
          : !logs.data?.length ? <div className="p-4"><EmptyState title="No log entries" body="No entries match the current filters." /></div>
          : (
            <ul className="max-h-[560px] divide-y divide-border overflow-y-auto font-mono text-[12px]">
              {logs.data.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <span className="text-text-3">{formatTime(l.ts)}</span>
                  <span className="text-text-3">{l.category}</span>
                  <Badge tone={SEV_TONE[l.severity]}>{l.severity}</Badge>
                  <span className="min-w-0 flex-1 text-text-2">{l.message}</span>
                </li>
              ))}
            </ul>
          )}
      </Card>
      <p className="text-[11px] text-text-3">Credentials and secrets are never included in log output.</p>
    </div>
  );
}
