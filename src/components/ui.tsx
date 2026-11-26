"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useUi } from "@/lib/store";
import { cn } from "@/lib/utils";

// ---------- Primitives ----------
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-border bg-card", className)}>{children}</div>;
}

export function Button({
  children, onClick, variant = "secondary", disabled, title, className,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean; title?: string; className?: string;
}) {
  const styles = {
    primary: "bg-accent text-black hover:bg-accent-bright font-medium",
    secondary: "bg-surface text-text border border-border hover:bg-hover",
    danger: "bg-error/10 text-error border border-error/30 hover:bg-error/20",
    ghost: "text-text-2 hover:text-text hover:bg-hover",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
        styles[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "error" | "info" | "accent" }) {
  const tones = {
    neutral: "border-border text-text-2 bg-surface",
    success: "border-success/30 text-success bg-success/10",
    warning: "border-warning/30 text-warning bg-warning/10",
    error: "border-error/30 text-error bg-error/10",
    info: "border-info/30 text-info bg-info/10",
    accent: "border-accent/30 text-accent-bright bg-accent/10",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-text-3", className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="text-text-3">{icon}</div>}
      <p className="text-sm font-medium text-text">{title}</p>
      {body && <p className="max-w-sm text-[13px] text-text-2">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-error/30 bg-error/5 px-6 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-error" />
      <p className="text-sm font-medium text-text">{title}</p>
      {body && <p className="max-w-md text-[13px] text-text-2">{body}</p>}
      {onRetry && <Button onClick={onRetry} className="mt-2">Retry</Button>}
    </div>
  );
}

export function OfflineState({ title = "No Android Station connected", body }: { title?: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-6 py-12 text-center">
      <Info className="h-6 w-6 text-warning" />
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="max-w-md text-[13px] text-text-2">
        {body ?? "Founda Dock is a control interface — the Android device runs the actual shell, processes and agents. Pair your device to enable live data."}
      </p>
      <Link href="/connections"><Button variant="primary" className="mt-2">Pair a device</Button></Link>
    </div>
  );
}

// ---------- Global overlays: toasts + confirmation ----------
export function Toasts() {
  const { toasts, dismissToast } = useUi();
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2.5 shadow-xl">
          {t.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
          {t.kind === "error" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />}
          {t.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />}
          <p className="flex-1 text-[13px] text-text">{t.title}</p>
          <button onClick={() => dismissToast(t.id)} className="text-text-3 hover:text-text" aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog() {
  const { confirm, closeConfirm } = useUi();
  if (!confirm.open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-border-strong bg-surface p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h2 className="text-sm font-semibold text-text">{confirm.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-text-2">{confirm.body}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={closeConfirm}>Cancel</Button>
          <Button variant="danger" onClick={() => { confirm.onConfirm?.(); closeConfirm(); }}>{confirm.confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
