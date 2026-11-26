"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Button, Card, ErrorState, Skeleton } from "@/components/ui";
import type { StationSettings } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[12px] text-text-2">{label}{children}</label>;
}

const inputCls = "mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-text";

export default function SettingsPage() {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast } = useUi();
  const [draft, setDraft] = useState<StationSettings | null>(null);
  const [prevData, setPrevData] = useState<StationSettings | undefined>(undefined);

  const settings = useQuery({ queryKey: ["settings"], queryFn: () => provider.getSettings() });
  // Adjust state during render when fresh server data arrives (React-endorsed pattern).
  if (settings.data && settings.data !== prevData) {
    setPrevData(settings.data);
    setDraft({ ...settings.data });
  }

  const save = useMutation({
    mutationFn: () => provider.saveSettings(draft!),
    onSuccess: () => { toast("Settings saved", "success"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Save failed", "error"),
  });

  if (settings.isLoading || !draft) return <Skeleton className="h-96" />;
  if (settings.isError) return <ErrorState title="Settings unavailable" onRetry={() => settings.refetch()} />;

  const set = <K extends keyof StationSettings>(k: K, v: StationSettings[K]) => setDraft({ ...draft, [k]: v });

  return (
    <div className="flex flex-col gap-6">
      <Section title="General">
        <Field label="Station name"><input className={inputCls} value={draft.stationName} onChange={(e) => set("stationName", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Theme">
            <select className={inputCls} value={draft.theme} onChange={(e) => set("theme", e.target.value as StationSettings["theme"])}><option value="dark">Dark</option><option value="light">Light</option></select>
          </Field>
          <Field label="Time format">
            <select className={inputCls} value={draft.timeFormat} onChange={(e) => set("timeFormat", e.target.value as StationSettings["timeFormat"])}><option value="24h">24-hour</option><option value="12h">12-hour</option></select>
          </Field>
          <Field label="Default workspace"><input className={inputCls} value={draft.defaultWorkspace} onChange={(e) => set("defaultWorkspace", e.target.value)} /></Field>
          <Field label="Default terminal shell"><input className={inputCls} value={draft.defaultShell} onChange={(e) => set("defaultShell", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Runtime">
        <label className="flex items-center gap-2 text-[13px] text-text-2">
          <input type="checkbox" checked={draft.hybridRuntimeMode} onChange={(e) => set("hybridRuntimeMode", e.target.checked)} className="accent-emerald-500" />
          Hybrid runtime mode
        </label>
        <Field label="Health-check interval (seconds)"><input type="number" className={inputCls} value={draft.healthCheckIntervalSec} onChange={(e) => set("healthCheckIntervalSec", Number(e.target.value))} /></Field>
        <Field label="Session timeout (minutes)"><input type="number" className={inputCls} value={draft.sessionTimeoutMin} onChange={(e) => set("sessionTimeoutMin", Number(e.target.value))} /></Field>
        <p className="text-[12px] text-text-3">Android-only runtime settings are configured on the device: <span className="font-medium text-text-2">Configure on Android device</span>.</p>
      </Section>

      <Section title="Security">
        <label className="flex items-center gap-2 text-[13px] text-text-2">
          <input type="checkbox" checked={draft.remoteAccessEnabled} onChange={(e) => set("remoteAccessEnabled", e.target.checked)} className="accent-emerald-500" />
          Remote access enabled
        </label>
        <p className="text-[12px] text-text-3">Session timeout, device authentication, access revocation and credential management are enforced by the Android runtime. The browser is never trusted merely because it has a valid connection.</p>
      </Section>

      <Section title="Notifications">
        {(Object.keys(draft.notifications) as (keyof StationSettings["notifications"])[]).map((k) => (
          <label key={k} className="flex items-center gap-2 text-[13px] text-text-2">
            <input type="checkbox" checked={draft.notifications[k]} onChange={(e) => setDraft({ ...draft, notifications: { ...draft.notifications, [k]: e.target.checked } })} className="accent-emerald-500" />
            {k.replace(/([A-Z])/g, " $1")}
          </label>
        ))}
      </Section>

      <Section title="About">
        <p className="font-mono text-[12px] text-text-3">Founda Dock web v0.1.0 · Station API v1 · Build: web (Next.js)</p>
        <p className="text-[12px] text-text-3">Documentation lives in <span className="font-mono">docs/API_CONTRACT.md</span>.</p>
      </Section>

      <div className="flex justify-end">
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>Save settings</Button>
      </div>
    </div>
  );
}
