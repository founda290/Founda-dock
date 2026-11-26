"use client";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, File, Folder, FolderPlus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/utils";

const ROOT = "~/projects";

export default function FilesPage() {
  const provider = useStation();
  const qc = useQueryClient();
  const { toast, askConfirm } = useUi();
  const [path, setPath] = useState(ROOT);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<{ name: string; content: string; truncated: boolean } | null>(null);
  const [folderName, setFolderName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const files = useQuery({ queryKey: ["files", path], queryFn: () => provider.listFiles(path) });
  const crumbs = path.split("/").filter(Boolean);
  const entries = (files.data ?? []).filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["files", path] });
  const mkdir = useMutation({
    mutationFn: () => provider.createFolder(path, folderName.trim()),
    onSuccess: () => { toast("Folder created", "success"); setFolderName(""); invalidate(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Create failed", "error"),
  });
  const remove = useMutation({
    mutationFn: (p: string) => provider.deleteFile(p),
    onSuccess: () => { toast("Deleted", "success"); invalidate(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Delete failed", "error"),
  });
  const upload = useMutation({
    mutationFn: (f: File) => provider.uploadFile(path, f),
    onSuccess: () => { toast("Upload complete", "success"); invalidate(); },
    onError: (e) => toast(e instanceof Error ? e.message : "Upload failed", "error"),
  });
  const openFile = async (p: string, name: string) => {
    try {
      const r = await provider.readFile(p);
      setPreview({ name, content: r.content, truncated: r.truncated });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Preview failed", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumbs + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex items-center gap-1 font-mono text-[12px] text-text-2" aria-label="Breadcrumb">
          <button className="hover:text-accent-bright" onClick={() => setPath(ROOT)}>~</button>
          {crumbs.map((c, i) => {
            const p = crumbs.slice(0, i + 1).join("/");
            const full = p.startsWith("~") ? p : `~/${p}`;
            return (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-text-3" />
                <button className="hover:text-accent-bright" onClick={() => setPath(full)}>{c}</button>
              </span>
            );
          })}
        </nav>
        <div className="ml-auto flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-text-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-44 rounded-md border border-border bg-surface py-1.5 pl-8 pr-2 text-[13px] text-text placeholder:text-text-3" />
          </div>
          <Button variant="ghost" onClick={() => files.refetch()} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button onClick={() => fileInput.current?.click()}><Upload className="h-3.5 w-3.5" /> Upload</Button>
          <input ref={fileInput} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">Files</h3></div>
          {files.isLoading ? <div className="p-4"><Skeleton className="h-40" /></div>
            : files.isError ? <div className="p-4"><ErrorState title="Cannot list directory" body={files.error instanceof Error ? files.error.message : "Permission denied. The runtime only exposes permitted workspace directories."} onRetry={() => files.refetch()} /></div>
            : !entries.length ? <div className="p-4"><EmptyState title="Empty directory" body="No files match. Create a folder or upload a file." /></div>
            : (
              <ul className="divide-y divide-border">
                {entries.map((f) => (
                  <li key={f.path} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                    {f.type === "dir" ? <Folder className="h-4 w-4 shrink-0 text-accent-bright" /> : <File className="h-4 w-4 shrink-0 text-text-3" />}
                    <button className="truncate text-left text-text-2 hover:text-accent-bright" onClick={() => f.type === "dir" ? setPath(f.path) : openFile(f.path, f.name)}>{f.name}</button>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-text-3">{f.type === "file" ? formatBytes(f.sizeBytes) : ""} · {formatDate(f.modifiedAt)}</span>
                    <Button variant="ghost" className="text-error" title="Delete" onClick={() => askConfirm(`Delete ${f.name}?`, "This permanently removes the file from the device.", "Delete", () => remove.mutate(f.path))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </li>
                ))}
              </ul>
            )}
          <div className="flex gap-2 border-t border-border p-3">
            <input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="New folder name" className="flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-text" />
            <Button disabled={!folderName.trim() || mkdir.isPending} onClick={() => mkdir.mutate()}><FolderPlus className="h-3.5 w-3.5" /> Create</Button>
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-text">{preview ? preview.name : "Preview"}</h3></div>
          {preview ? (
            <div className="p-4">
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-bg p-3 font-mono text-[12px] leading-relaxed text-text-2">{preview.content}</pre>
              {preview.truncated && <p className="mt-2 text-[11px] text-warning">Preview truncated — file is large.</p>}
            </div>
          ) : <div className="p-4"><EmptyState title="No file selected" body="Select a text file to preview its contents. Large files are handled efficiently by the runtime." /></div>}
        </Card>
      </div>
    </div>
  );
}
