"use client";
import { usePathname } from "next/navigation";
import { Bell, Menu, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { Badge } from "./ui";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/terminal": "Terminal",
  "/agents": "Agents",
  "/workspaces": "Workspaces",
  "/files": "Files",
  "/system": "System Monitor",
  "/connections": "Connections",
  "/logs": "Logs",
  "/settings": "Settings",
  "/help": "Help / Documentation",
};

export function AppHeader() {
  const pathname = usePathname();
  const provider = useStation();
  const { setMobileNav } = useUi();
  const { data: station } = useQuery({ queryKey: ["station"], queryFn: () => provider.getStation(), refetchInterval: 15000 });
  const title = TITLES[pathname] ?? (pathname.startsWith("/workspaces/") ? "Workspace Details" : "Founda Dock");

  const statusTone =
    station?.status === "connected" || station?.status === "running" || station?.status === "background-active"
      ? "success" : station?.status === "connecting" || station?.status === "idle"
        ? "warning" : station?.status === "error" || station?.status === "interrupted"
          ? "error" : "neutral";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur">
      <button onClick={() => setMobileNav(true)} className="rounded-md p-1.5 text-text-2 hover:bg-hover hover:text-text lg:hidden" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-text">{title}</h1>
        <p className="hidden truncate text-[11px] text-text-3 sm:block">{station?.name ?? "Founda Dock"}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {provider.mode === "mock" && <Badge tone="warning">SIMULATED</Badge>}
        <Badge tone={statusTone as "success" | "warning" | "error" | "neutral"}>
          <span className={cn("h-1.5 w-1.5 rounded-full", station?.status === "connected" || station?.status === "running" ? "bg-success" : "bg-current")} />
          {station?.status ?? "disconnected"}
        </Badge>
        <button className="rounded-md p-2 text-text-2 hover:bg-hover hover:text-text" aria-label="Notifications" title="Notifications">
          <Bell className="h-4.5 w-4.5" />
        </button>
        <button className="rounded-md p-2 text-text-2 hover:bg-hover hover:text-text" aria-label="User menu" title="User menu">
          <User className="h-4.5 w-4.5" />
        </button>
      </div>
    </header>
  );
}
