"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plug, QrCode, Trash2 } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function ConnectionsPage() {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast, askConfirm } = useUi();
  const [code, setCode] = useState("");
  const [remote, setRemote] = useState(false);

  const conns = useQuery({ queryKey: ["connections"], queryFn: () => provider.getConnections(), refetchInterval: 15000 });
  const pair = useMutation({
    mutationFn: () => provider.pairDevice(code.trim()),
    onSuccess: () => { toast("Device paired", "success"); setCode(""); qc.invalidateQueries({ queryKey: ["connections"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Pairing failed", "error"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => provider.revokeConnection(id),
    onSuccess: () => { toast("Connection revoked", "success"); qc.invalidateQueries({ queryKey: ["connections"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Revoke failed", "error"),
  });
  const rotate = useMutation({
    mutationFn: () => provider.rotateCredentials(),
    onSuccess: () => toast("Credentials rotated", "success"),
    onError: (e) => toast(e instanceof Error ? e.message : "Rotation failed", "error"),
  });
  const toggleRemote = useMutation({
    mutationFn: (enabled: boolean) => provider.setRemoteAccess(enabled),
    onSuccess: () => { toast("Remote access updated", "success"); qc.invalidateQueries({ queryKey: ["connections"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Update failed", "error"),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <QrCode className="mt-0.5 h-5 w-5 text-accent-bright" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-text">Pair a browser</h3>
            <p className="mt-1 max-w-xl text-[13px] text-text-2">
              Enter the pairing code shown on the Android device. Pairing is authenticated — remote terminal access is
              never unauthenticated, and credentials are never placed in URLs.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Pairing code" className="w-48 rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-[13px] text-text" />
              <Button variant="primary" disabled={!code.trim() || pair.isPending} onClick={() => pair.mutate()}><Plug className="h-3.5 w-3.5" /> Pair</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Connections</h3></div>
        {conns.isLoading ? <div className="p-4"><Skeleton className="h-32" /></div>
          : conns.isError ? <div className="p-4"><ErrorState title="Connection data unavailable" onRetry={() => conns.refetch()} /></div>
          : !conns.data?.length ? <div className="p-4"><EmptyState title="No connections" body="Pair a device to establish a connection." /></div>
          : (
            <ul className="divide-y divide-border">
              {conns.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-text">{c.label}</p>
                    <p className="font-mono text-[11px] text-text-3">
                      {c.endpoint ?? "no endpoint"} · heartbeat {formatDate(c.lastHeartbeat)} · last success {formatDate(c.lastSuccessful)}
                    </p>
                  </div>
                  <Badge tone={c.status === "connected" ? "success" : c.status === "error" ? "error" : "neutral"}>{c.status}</Badge>
                  <Badge tone={c.authenticated ? "accent" : "warning"}>{c.authenticated ? "authenticated" : "unauthenticated"}</Badge>
                  <Button variant="ghost" className="text-error" title="Revoke connection" onClick={() => askConfirm(`Revoke ${c.label}?`, "This browser session will lose access immediately.", "Revoke", () => revoke.mutate(c.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">Remote access</p>
            <p className="text-[12px] text-text-2">Enable the tunnel for browser access outside the local network.</p>
          </div>
          <button
            role="switch" aria-checked={remote} onClick={() => { setRemote(!remote); toggleRemote.mutate(!remote); }}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${remote ? "bg-accent" : "bg-surface border border-border"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${remote ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <KeyRound className="h-5 w-5 text-text-3" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">Rotate credentials</p>
            <p className="text-[12px] text-text-2">Invalidates existing browser sessions.</p>
          </div>
          <Button onClick={() => askConfirm("Rotate credentials?", "All paired browsers will need to pair again.", "Rotate", () => rotate.mutate())}>Rotate</Button>
        </Card>
      </div>
    </div>
  );
}
