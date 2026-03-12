"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { GpuSlot, StockResponse } from "@/lib/api";
import { fetchStock, getWebSocketUrl, slotKey } from "@/lib/api";

type StockState = {
  slots: GpuSlot[];
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
};

const StockContext = createContext<StockState | null>(null);

export function StockProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StockState>({
    slots: [],
    updatedAt: null,
    loading: true,
    error: null,
  });

  const hydrate = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data: StockResponse = await fetchStock();
      setState({
        slots: data.slots,
        updatedAt: data.updatedAt,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load",
      }));
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const wsUrl = getWebSocketUrl();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        console.log("[RunStock] WebSocket connected to", wsUrl);
      }
    };
    ws.onerror = (e) => {
      console.warn("[RunStock] WebSocket error:", e);
    };
    ws.onclose = (e) => {
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development" && !e.wasClean) {
        console.warn("[RunStock] WebSocket closed unexpectedly:", e.code, e.reason);
      }
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as {
          type?: string;
          payload?: { transitions?: GpuSlot[] };
        };
        if (msg.type === "STOCK_CHANGE" && msg.payload?.transitions) {
          setState((s) => {
            const updated = new Map(s.slots.map((x) => [slotKey(x), x]));
            for (const t of msg.payload!.transitions!) {
              updated.set(slotKey(t), t);
            }
            return {
              ...s,
              slots: Array.from(updated.values()),
              updatedAt: new Date().toISOString(),
            };
          });
        }
      } catch {
      }
    };

    return () => ws.close();
  }, []);

  return (
    <StockContext.Provider value={state}>{children}</StockContext.Provider>
  );
}

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error("useStock must be used within StockProvider");
  return ctx;
}
