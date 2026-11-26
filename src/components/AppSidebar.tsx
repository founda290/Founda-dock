"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Bot, ChevronLeft, ChevronRight, FolderGit2, Files, HelpCircle,
  LayoutDashboard, Plug, ScrollText, Settings, Terminal, X, Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useStation } from "@/lib/query-provider";
import { useUi } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { section: "Workspace" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/terminal", label: "Terminal", icon: Terminal },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/workspaces", label: "Workspaces", icon: FolderGit2 },
  { href: "/files", label: "Files", icon: Files },
  { section: "System" },
  { href: "/system", label: "System Monitor", icon: Activity },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { section: "Preferences" },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help / Docs", icon: HelpCircle },
];

function StatusDot({ status }: { status: string }) {
  const color =
    status === "connected" || status === "running" || status === "background-active"
      ? "bg-success"
      : status === "connecting" || status === "idle"
        ? "bg-warning"
        : status === "error" || status === "interrupted"
          ? "bg-error"
          : "bg-text-3";
  return <span className={cn("h-2 w-2 rounded-full", color, status === "connecting" && "pulse-dot")} />;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav } = useUi();
  const provider = useStation();
  const { data: station } = useQuery({ queryKey: ["station"], queryFn: () => provider.getStation(), refetchInterval: 15000 });

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent-bright">
          <Zap className="h-4.5 w-4.5" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-text">Founda Dock</p>
            <p className="truncate text-[11px] leading-tight text-text-3">Code. Create. Automate.</p>
          </div>
        )}
        <button onClick={toggleSidebar} className="ml-auto hidden rounded-md p-1 text-text-3 hover:bg-hover hover:text-text lg:block" aria-label="Toggle sidebar">
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button onClick={() => setMobileNav(false)} className="ml-auto rounded-md p-1 text-text-3 hover:bg-hover hover:text-text lg:hidden" aria-label="Close navigation">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((item, i) =>
          "section" in item ? (
            !sidebarCollapsed && <p key={i} className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-text-3">{item.section}</p>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNav(false)}
              title={sidebarCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                  ? "bg-accent/10 font-medium text-accent-bright"
                  : "text-text-2 hover:bg-hover hover:text-text"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        {sidebarCollapsed ? (
          <div className="flex justify-center"><StatusDot status={station?.status ?? "disconnected"} /></div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <StatusDot status={station?.status ?? "disconnected"} />
              <span className="truncate text-[12px] text-text-2">{station?.deviceName ?? "No device"}</span>
            </div>
            <p className="mt-1 text-[11px] capitalize text-text-3">{station?.status ?? "disconnected"} · {provider.label}</p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-sidebar transition-all lg:block", sidebarCollapsed ? "w-16" : "w-60")}>
        {content}
      </aside>
      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-sidebar">{content}</aside>
        </div>
      )}
    </>
  );
}
