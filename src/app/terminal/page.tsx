"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize, Minimize, Plus, RotateCw, Trash2, X } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Badge, Button, EmptyState, OfflineState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TerminalSession } from "@/lib/types";

export default function TerminalPage() {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast, askConfirm } = useUi();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<{ term: import("@xterm/xterm").Terminal; fit: import("@xterm/addon-fit").FitAddon } | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => provider.listSessions(), refetchInterval: 10000 });
  const list = sessions.data ?? [];
  const active = list.find((s) => s.id === activeId) ?? list[0] ?? null;

  const create = useMutation({
    mutationFn: () => provider.createSession(),
    onSuccess: (s) => { toast(`Session ${s.name} created`, "success"); qc.invalidateQueries({ queryKey: ["sessions"] }); setActiveId(s.id); },
    onError: (e) => toast(e instanceof Error ? e.message : "Failed to create session", "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => provider.deleteSession(id),
    onSuccess: () => { toast("Session closed", "success"); qc.invalidateQueries({ queryKey: ["sessions"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Failed to close session", "error"),
  });

  // activeId is only ever set by user interaction (tab click / create);
  // `active` above already falls back to the first session when needed.

  // Initialise xterm once; re-attach when the active session changes.
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");
      if (disposed || !containerRef.current) return;
      if (!termRef.current) {
        const term = new Terminal({
          theme: { background: "#0D1210", foreground: "#F1F5F2", cursor: "#00C985", selectionBackground: "#1E3A2F" },
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          fontSize: 13,
          convertEol: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(containerRef.current);
        term.onData((data) => {
          const id = sessionIdRef.current;
          if (id) provider.sendTerminalInput(id, data);
        });
        term.onResize(({ cols, rows }) => {
          const id = sessionIdRef.current;
          if (id) provider.resizeTerminal(id, cols, rows);
        });
        termRef.current = { term, fit };
      }
      termRef.current.fit.fit();
    })();
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach to the active session and stream its output.
  useEffect(() => {
    sessionIdRef.current = active?.id ?? null;
    const t = termRef.current?.term;
    if (!t || !active) return;
    t.clear();
    t.writeln(`\x1b[90m# Founda Dock terminal — ${active.name} (${active.id})\x1b[0m`);
    t.writeln(`\x1b[90m# cwd: ${active.cwd} · status: ${active.status}\x1b[0m`);
    t.writeln("");
    provider.attachTerminal(active.id);
    const unsub = provider.subscribe((e) => {
      if (e.type === "terminal.output") {
        const p = e.payload as { sessionId: string; data: string };
        if (p.sessionId === active.id) t.write(p.data);
      }
      if (e.type === "terminal.exit") {
        const p = e.payload as { sessionId: string; exitCode: number | null };
        if (p.sessionId === active.id) t.writeln(`\r\n\x1b[33m[session exited, code ${p.exitCode}]\x1b[0m`);
      }
    });
    termRef.current?.fit.fit();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Resize observer for responsive terminal.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => termRef.current?.fit.fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onClear = useCallback(() => termRef.current?.term.clear(), []);
  const onRestart = useCallback(() => {
    if (!active) return;
    remove.mutate(active.id);
    setTimeout(() => create.mutate(), 300);
  }, [active, create, remove]);

  if (sessions.isError) return <OfflineState title="Terminal engine unreachable" body="The device is offline or the terminal engine is not running. Terminal sessions cannot be created until the Station reconnects." />;

  return (
    <div className={cn("flex flex-col gap-3", fullscreen && "fixed inset-0 z-50 bg-bg p-4")}>
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {sessions.isLoading ? <Skeleton className="h-9 w-48" /> : list.map((s: TerminalSession) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[12px]",
              s.id === active?.id ? "border-accent/40 bg-accent/10 text-accent-bright" : "border-border bg-surface text-text-2 hover:bg-hover"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", s.status === "active" ? "bg-success" : s.status === "reconnecting" ? "bg-warning pulse-dot" : "bg-text-3")} />
            {s.name}
            <span
              role="button"
              aria-label={`Close ${s.name}`}
              className="ml-1 rounded p-0.5 hover:bg-hover"
              onClick={(e) => { e.stopPropagation(); askConfirm(`Close session ${s.name}?`, "The shell process on the device will be terminated.", "Close", () => remove.mutate(s.id)); }}
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
        <Button variant="ghost" disabled={create.isPending} onClick={() => create.mutate()} title="New terminal session"><Plus className="h-4 w-4" /></Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <>
            <Badge tone="neutral">{active.name}</Badge>
            <span className="font-mono text-[11px] text-text-3">{active.cwd}</span>
            <Badge tone={active.status === "active" ? "success" : "warning"}>{active.status}</Badge>
            {active.pid != null && <span className="font-mono text-[11px] text-text-3">PID {active.pid}</span>}
          </>
        ) : <span className="text-[13px] text-text-3">No active session</span>}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" onClick={onClear} title="Clear terminal">Clear</Button>
          <Button variant="ghost" onClick={onRestart} title="Restart session"><RotateCw className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" disabled={!active} onClick={() => active && askConfirm(`Close session ${active.name}?`, "The shell process will be terminated.", "Close", () => remove.mutate(active.id))} title="Close session"><Trash2 className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" onClick={() => setFullscreen((f) => !f)} title="Toggle full screen">{fullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}</Button>
        </div>
      </div>

      {/* Viewport */}
      {sessions.isLoading ? <Skeleton className="h-[480px]" />
        : !active ? (
          <EmptyState
            title="No terminal sessions"
            body="Create a session to open a shell on the Android device. Sessions persist across navigation and reconnect automatically."
            action={<Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}><Plus className="h-3.5 w-3.5" /> New session</Button>}
          />
        ) : (
          <div ref={containerRef} className="h-[480px] overflow-hidden rounded-lg border border-border bg-bg-2" />
        )}
      <p className="text-[11px] text-text-3">
        {provider.mode === "mock"
          ? "SIMULATED terminal: input is echoed locally. Configure NEXT_PUBLIC_STATION_MODE=real and NEXT_PUBLIC_STATION_WS_URL to attach to a live device."
          : "Live terminal over authenticated WebSocket. Sessions reconnect automatically; the browser never creates duplicates."}
      </p>
    </div>
  );
}
