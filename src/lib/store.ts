"use client";
import { create } from "zustand";

// UI-only state (sidebar, toasts, dialogs). Server state lives in TanStack Query.
interface Toast { id: string; title: string; kind: "success" | "error" | "info" }
interface ConfirmState { open: boolean; title: string; body: string; confirmLabel: string; onConfirm: (() => void) | null }

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  toasts: Toast[];
  confirm: ConfirmState;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  toast: (title: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  askConfirm: (title: string, body: string, confirmLabel: string, onConfirm: () => void) => void;
  closeConfirm: () => void;
}

export const useUi = create<UiState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  toasts: [],
  confirm: { open: false, title: "", body: "", confirmLabel: "Confirm", onConfirm: null },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  toast: (title, kind = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, title, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  askConfirm: (title, body, confirmLabel, onConfirm) => set({ confirm: { open: true, title, body, confirmLabel, onConfirm } }),
  closeConfirm: () => set((s) => ({ confirm: { ...s.confirm, open: false, onConfirm: null } })),
}));
