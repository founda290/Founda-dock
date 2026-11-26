"use client";
import type { ReactNode } from "react";
import { useUi } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Shell({ children }: { children: ReactNode }) {
  const { sidebarCollapsed } = useUi();
  return (
    <div className={cn("transition-all", sidebarCollapsed ? "lg:pl-16" : "lg:pl-60")}>
      {children}
    </div>
  );
}
