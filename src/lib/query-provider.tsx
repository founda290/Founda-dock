"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { StationProvider } from "./provider";
import { getProviderMode } from "./provider";
import { MockStationProvider } from "./mock-provider";
import { RealStationProvider } from "./real-provider";

const ProviderCtx = createContext<StationProvider | null>(null);

export function useStation(): StationProvider {
  const p = useContext(ProviderCtx);
  if (!p) throw new Error("useStation must be used inside StationProviderRoot");
  return p;
}

export function StationProviderRoot({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5000 } },
  }));
  const provider = useMemo<StationProvider>(
    () => (getProviderMode() === "real" ? new RealStationProvider() : new MockStationProvider()),
    []
  );
  return (
    <QueryClientProvider client={client}>
      <ProviderCtx.Provider value={provider}>{children}</ProviderCtx.Provider>
    </QueryClientProvider>
  );
}
