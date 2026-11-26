"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plug, QrCode, Trash2 } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { RealStationProvider, getSessionToken } from "@/lib/real-provider";
import { useUi } from "@/lib/store";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const STATE_LABELS: Record<string, { label: string; hint: string; tone: "success" | "warning" | "error" | "neutral" | "info" }> = {
  "not-configured": { label: "Not configured", hint: "Set NEXT_PUBLIC_STATION_API_URL to point at your Android Station.", tone: "neutral" },
  "pairing-required": { label: "Pairing required", hint: "Generate a pairing code on the device (node dist/cli.js pair) and enter it below.", tone: "warning" },
  "connecting": { label: "Connecting", hint: "Contacting the Station runtime…", tone: "info" },
  "connected": { label: "Connected", hint: "This browser is paired and authenticated.", tone: "success" },
  "reconnecting": { label: "Reconnecting", hint: "Connection dropped — retrying with backoff. Sessions are preserved.", tone: "warning" },
  "disconnected": { label: "Disconnected", hint: "The Android device is unreachable. Wake the device or check Wi-Fi.", tone: "error" },
  "authentication-failed": { label: "Authentication failed", hint: "Your session expired or was revoked. Pair again with a fresh code.", tone: "error" },
  "runtime-error": { label: "Runtime error", hint: "The Station reported an error. Check device logs.", tone: "error" },
};

export default function ConnectionsPage() {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast, askConfirm } = useUi();
  const [code, setCode] = useState("");
  const [remote, setRemote] = useState(false);

  const isReal = provider.mode === "real";
  const connState = isReal && provider instanceof RealStationProvider ? provider.getConnectionState() : "connected";
  const stateInfo = STATE_LABELS[connState] ?? STATE_LABELS["disconnected"];

  const conns = useQuery({
    queryKey: ["connections"],
    queryFn: () => provider.getConnections(),
    refetchInterval: 15000,
    enabled: !isReal || getSessionToken() != null,
  });
  const pair = useMutation({
    mutationFn: () => provider.pairDevice(code.trim()),
    onSuccess: () => { toast("Device paired", "success"); setCode(""); qc.invalidateQueries({ queryKey: ["connections"] }); qc.invalidateQueries({ queryKey: ["station"] }); },
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
        <div className="flex flex-wrap items-start gap-3">
          <QrCode className="mt-0.5 h-5 w-5 text-accent-bright" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-text">Pair a browser</h3>
              <Badge tone={stateInfo.tone}>{stateInfo.label}</Badge>
            </div>
            <p className="mt-1 max-w-xl text-[13px] text-text-2">
              {stateInfo.hint} Pairing uses a short-lived, single-use code generated on the Android device.
              The session token is kept in memory only — never in URLs or localStorage.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit pairing code" inputMode="numeric" className="w-48 rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-[13px] text-text" />
              <Button variant="primary" disabled={!code.trim() || pair.isPending} onClick={() => pair.mutate()}><Plug className="h-3.5 w-3.5" /> Pair</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Connections</h3></div>
        {conns.isLoading ? <div className="p-4"><Skeleton className="h-32" /></div>
          : conns.isError ? <div className="p-4"><ErrorState title="Connection data unavailable" body={isReal ? "Pair this browser first, then connection data will load." : undefined} onRetry={() => conns.refetch()} /></div>
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
            <p className="text-[12px] text-text-2">Enable the tunnel for browser access outside the local network. Requires Cloudflare Tunnel on the device — see runtime/docs.</p>
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
