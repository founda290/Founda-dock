"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File, Folder, GitBranch, Terminal } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const provider = useStation();
  const qc = useQueryClient();
  const { toast } = useUi();
  const [newName, setNewName] = useState("");

  const ws = useQuery({ queryKey: ["workspace", id], queryFn: () => provider.getWorkspace(id) });
  const git = useMutation({
    mutationFn: (a: "pull" | "push" | "status") => provider.gitAction(id, a),
    onSuccess: () => { toast("Git operation completed", "success"); qc.invalidateQueries({ queryKey: ["workspace", id] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Git failed", "error"),
  });
  const rename = useMutation({
    mutationFn: () => provider.renameWorkspace(id, newName.trim()),
    onSuccess: () => { toast("Renamed", "success"); qc.invalidateQueries({ queryKey: ["workspace", id] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Rename failed", "error"),
  });

  if (ws.isLoading) return <Skeleton className="h-64" />;
  if (ws.isError || !ws.data) return <ErrorState title="Workspace not found" body="This workspace could not be loaded from the runtime." onRetry={() => ws.refetch()} />;

  const w = ws.data;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text">{w.name}</h2>
            <Badge tone={w.gitStatus === "clean" ? "success" : w.gitStatus === "dirty" ? "warning" : "neutral"}>{w.gitStatus}</Badge>
            {w.gitBranch && <span className="inline-flex items-center gap-1 text-[12px] text-text-2"><GitBranch className="h-3.5 w-3.5" />{w.gitBranch}</span>}
          </div>
          <p className="mt-1 font-mono text-[12px] text-text-3">{w.path} · {w.type} · modified {formatDate(w.lastModified)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/terminal"><Button><Terminal className="h-3.5 w-3.5" /> Open terminal here</Button></Link>
          <Button disabled={git.isPending} onClick={() => git.mutate("pull")}>Pull</Button>
          <Button disabled={git.isPending} onClick={() => git.mutate("push")}>Push</Button>
          <Button disabled={git.isPending} onClick={() => git.mutate("status")}>Status</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Directory structure</h3></div>
          <ul className="divide-y divide-border">
            {w.tree.map((f) => (
              <li key={f.path} className="flex items-center gap-2 px-4 py-2 text-[13px]">
                {f.type === "dir" ? <Folder className="h-4 w-4 text-accent-bright" /> : <File className="h-4 w-4 text-text-3" />}
                <span className="text-text-2">{f.name}</span>
                <span className="ml-auto font-mono text-[11px] text-text-3">{formatDate(f.modifiedAt)}</span>
              </li>
            ))}
            {!w.tree.length && <li className="px-4 py-6 text-center text-[13px] text-text-3">Directory is empty or unavailable.</li>}
          </ul>
        </Card>
        <Card>
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Recent commits</h3></div>
          <ul className="divide-y divide-border">
            {w.commits.map((c) => (
              <li key={c.hash} className="px-4 py-2.5">
                <p className="text-[13px] text-text-2">{c.message}</p>
                <p className="font-mono text-[11px] text-text-3">{c.hash} · {formatDate(c.date)}</p>
              </li>
            ))}
            {!w.commits.length && <li className="px-4 py-6 text-center text-[13px] text-text-3">No commits yet.</li>}
          </ul>
        </Card>
      </div>

      <Card className="flex flex-wrap items-end gap-2 p-4">
        <label className="flex-1 text-[12px] text-text-2">Rename workspace
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={w.name} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-text" />
        </label>
        <Button disabled={!newName.trim() || rename.isPending} onClick={() => rename.mutate()}>Rename</Button>
      </Card>
    </div>
  );
}
