"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { GpuSlot } from "@/lib/api";
import { chartTierKey, slotKey } from "@/lib/api";
import { MAX_CHART_SLOTS } from "@/components/GpuPriceChart";

export { chartTierKey, slotKey };

type ChartSelectionContextValue = {
  chartSlots: GpuSlot[];
  addChartSlot: (slot: GpuSlot) => void;
  removeChartSlot: (slot: GpuSlot) => void;
  toggleChartSlot: (slot: GpuSlot) => void;
  clearChartSlots: () => void;
  selectedSlot: GpuSlot | null;
  setSelectedSlot: (slot: GpuSlot | null) => void;
  canAddToChart: boolean;
};

const ChartSelectionContext = createContext<ChartSelectionContextValue | null>(null);

export function ChartSelectionProvider({ children }: { children: React.ReactNode }) {
  const [chartSlots, setChartSlots] = useState<GpuSlot[]>([]);

  const addChartSlot = useCallback((slot: GpuSlot) => {
    setChartSlots((prev) => {
      const k = chartTierKey(slot);
      if (prev.some((s) => chartTierKey(s) === k)) return prev;
      if (prev.length >= MAX_CHART_SLOTS) return prev;
      return [...prev, slot];
    });
  }, []);

  const removeChartSlot = useCallback((slot: GpuSlot) => {
    const k = chartTierKey(slot);
    setChartSlots((prev) => prev.filter((s) => chartTierKey(s) !== k));
  }, []);

  const toggleChartSlot = useCallback((slot: GpuSlot) => {
    const k = chartTierKey(slot);
    setChartSlots((prev) => {
      const idx = prev.findIndex((s) => chartTierKey(s) === k);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= MAX_CHART_SLOTS) return prev;
      return [...prev, slot];
    });
  }, []);

  const canAddToChart = chartSlots.length < MAX_CHART_SLOTS;

  const clearChartSlots = useCallback(() => setChartSlots([]), []);

  const setSelectedSlot = useCallback((slot: GpuSlot | null) => {
    if (slot) addChartSlot(slot);
  }, [addChartSlot]);

  const value = useMemo(
    () => ({
      chartSlots,
      addChartSlot,
      removeChartSlot,
      toggleChartSlot,
      clearChartSlots,
      selectedSlot: chartSlots[0] ?? null,
      setSelectedSlot,
      canAddToChart,
    }),
    [
      chartSlots,
      addChartSlot,
      removeChartSlot,
      toggleChartSlot,
      clearChartSlots,
      setSelectedSlot,
      canAddToChart,
    ],
  );
  return (
    <ChartSelectionContext.Provider value={value}>
      {children}
    </ChartSelectionContext.Provider>
  );
}

export function useChartSelection() {
  const ctx = useContext(ChartSelectionContext);
  if (!ctx) throw new Error("useChartSelection must be used within ChartSelectionProvider");
  return ctx;
}
