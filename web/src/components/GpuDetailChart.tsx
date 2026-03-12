"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GpuSlot } from "@/lib/api";
import { fetchSeries } from "@/lib/api";
import { GpuPriceChart, CHART_COLORS } from "./GpuPriceChart";
import { useChartSelection } from "@/contexts/ChartSelectionContext";
import { useStock } from "@/contexts/StockContext";
import { displayGpuName } from "@/lib/gpu-family";
import type { PriceSample } from "@/lib/api";

function slotKey(s: GpuSlot) {
  return `${s.gpu_type}|${s.service_tier}`;
}

function slotDisplayLabel(s: GpuSlot) {
  return `${displayGpuName(s.gpu_type)} · ${s.service_tier}`;
}

const RANGE_OPTIONS = [
  { hours: 1, label: "1h" },
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 48, label: "48h" },
  { hours: 168, label: "7d" },
] as const;

export function GpuDetailChart() {
  const { chartSlots, removeChartSlot, clearChartSlots } = useChartSelection();
  const { updatedAt } = useStock();
  const [seriesData, setSeriesData] = useState<Map<string, PriceSample[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(1);

  const fetchAll = useCallback(async () => {
    if (chartSlots.length === 0) {
      setSeriesData(new Map());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        chartSlots.map((s) =>
          fetchSeries({
            gpu_type: s.gpu_type,
            region: s.region,
            service_tier: s.service_tier,
            hours,
          }).then((res) => ({ key: slotKey(s), data: res.data })),
        ),
      );
      const map = new Map(results.map((r) => [r.key, r.data]));
      setSeriesData(map);
    } catch (err) {
      setError(String(err));
      setSeriesData(new Map());
    } finally {
      setLoading(false);
    }
  }, [chartSlots, hours]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, updatedAt]);

  const chartSeries = useMemo(() => {
    return chartSlots.map((s, i) => ({
      label: slotDisplayLabel(s),
      data: seriesData.get(slotKey(s)) ?? [],
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [chartSlots, seriesData]);

  const hasData = chartSeries.some((s) => s.data.filter((d) => d.price > 0).length >= 2);

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-semibold text-[var(--text-primary)]">
          Price history
        </h2>
        <div className="inline-flex overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.hours}
              type="button"
              onClick={() => setHours(opt.hours)}
              className={`relative z-0 cursor-pointer px-2 py-0.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-surface)] ${
                hours === opt.hours
                  ? "z-10 bg-[var(--accent)] text-[var(--bg-deep)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {chartSlots.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {chartSlots.map((s) => (
            <span
              key={slotKey(s)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-xs"
            >
              <span
                className="h-1 w-1 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    CHART_COLORS[chartSlots.indexOf(s) % CHART_COLORS.length],
                }}
              />
              {slotDisplayLabel(s)}
              <button
                type="button"
                onClick={() => removeChartSlot(s)}
                className="ml-0.5 cursor-pointer text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label={`Remove ${slotDisplayLabel(s)}`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearChartSlots}
            className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Clear
          </button>
        </div>
      )}

      {loading && (
        <div className="flex h-[360px] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--error)]/50 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {!loading && !error && chartSlots.length === 0 && (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)]">
          <p className="text-sm text-[var(--text-muted)]">
            Click cards below to add GPUs to the chart
          </p>
        </div>
      )}

      {!loading && !error && chartSlots.length > 0 && !hasData && (
        <div className="flex h-[360px] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <p className="max-w-md text-center text-sm text-[var(--text-muted)]">
            No price history yet for selected GPUs. Sampling runs every ~5 min — check back after
            ingestion has collected data.
          </p>
        </div>
      )}

      {!loading && !error && hasData && (
        <div>
          <GpuPriceChart series={chartSeries} height={360} />
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            Sampled every ~5 min. Red line = gap in data (unavailable or missed sample). Add GPUs to compare (max 6).
          </p>
        </div>
      )}
    </section>
  );
}
