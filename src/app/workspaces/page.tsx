"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderGit2, GitBranch, Plus, RefreshCw, Terminal, Trash2 } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function WorkspacesPage() {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast, askConfirm } = useUi();
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const ws = useQuery({ queryKey: ["workspaces"], queryFn: () => provider.listWorkspaces() });
  const create = useMutation({
    mutationFn: () => provider.createWorkspace(name.trim()),
    onSuccess: () => { toast("Workspace created", "success"); setName(""); setShowCreate(false); qc.invalidateQueries({ queryKey: ["workspaces"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Create failed", "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => provider.deleteWorkspace(id),
    onSuccess: () => { toast("Workspace deleted", "success"); qc.invalidateQueries({ queryKey: ["workspaces"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-text-2">Projects hosted on the Android device. Git runs on the runtime — the browser never touches the phone filesystem directly.</p>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => ws.refetch()} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button variant="primary" onClick={() => setShowCreate((v) => !v)}><Plus className="h-3.5 w-3.5" /> New workspace</Button>
        </div>
      </div>

      {showCreate && (
        <Card className="flex flex-wrap items-end gap-2 p-4">
          <label className="flex-1 text-[12px] text-text-2">Workspace name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-project" className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-text" />
          </label>
          <Button variant="primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>Create</Button>
          <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
        </Card>
      )}

      {ws.isLoading ? <Skeleton className="h-48" />
        : ws.isError ? <ErrorState title="Workspaces unavailable" body="The runtime did not return workspace data." onRetry={() => ws.refetch()} />
        : !ws.data?.length ? <EmptyState title="No workspaces" body="Create a workspace or clone a repository on the device to get started." />
        : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ws.data.map((w) => (
              <Card key={w.id} className="flex flex-col p-4">
                <div className="flex items-start gap-2">
                  <FolderGit2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/workspaces/${w.id}`} className="truncate text-sm font-medium text-text hover:text-accent-bright">{w.name}</Link>
                    <p className="truncate font-mono text-[11px] text-text-3">{w.path}</p>
                  </div>
                  <Badge tone={w.gitStatus === "clean" ? "success" : w.gitStatus === "dirty" ? "warning" : "neutral"}>
                    {w.gitStatus === "not-a-repo" ? "no git" : w.gitStatus}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-text-3">
                  <span>{w.type}</span>
                  {w.gitBranch && <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{w.gitBranch}</span>}
                  <span>modified {formatDate(w.lastModified)}</span>
                </div>
                {w.lastCommit && <p className="mt-1 truncate font-mono text-[11px] text-text-3">{w.lastCommit}</p>}
                <div className="mt-3 flex gap-1 border-t border-border pt-3">
                  <Link href={`/workspaces/${w.id}`}><Button variant="ghost">Open</Button></Link>
                  <Link href="/terminal"><Button variant="ghost" title="Open terminal in workspace"><Terminal className="h-3.5 w-3.5" /></Button></Link>
                  <Button variant="ghost" className="ml-auto text-error" title="Delete workspace" onClick={() => askConfirm(`Delete ${w.name}?`, "This removes the workspace from the device.", "Delete", () => remove.mutate(w.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
