"use client";

import { useMemo, useState } from "react";
import { useStock } from "@/contexts/StockContext";
import { GpuCard } from "./GpuCard";
import { getGpuCategory, getProductDocUrl } from "@/lib/gpu-family";
import type { GpuSlot } from "@/lib/api";
import { chartTierKey, compareRegions } from "@/lib/api";

type TierFilter = "secure" | "community";
type PriceSort = "asc" | "desc";

function slotCompare(a: GpuSlot, b: GpuSlot, priceSort: PriceSort): number {
  const aAvail = a.status === "available" ? 1 : 0;
  const bAvail = b.status === "available" ? 1 : 0;
  if (aAvail !== bAvail) return bAvail - aAvail;

  const aTier = a.service_tier === "secure" ? 0 : 1;
  const bTier = b.service_tier === "secure" ? 0 : 1;
  if (aTier !== bTier) return aTier - bTier;

  const diff = a.current_price - b.current_price;
  const priceCmp = priceSort === "asc" ? diff : -diff;
  if (priceCmp !== 0) return priceCmp;

  return compareRegions(a.region, b.region);
}

export function StockDashboard() {
  const { slots, loading, error, updatedAt } = useStock();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("secure");
  const [priceSort, setPriceSort] = useState<PriceSort>("asc");

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!s.gpu_type.toLowerCase().includes(q)) return false;
      }
      if (s.service_tier !== tierFilter) return false;
      return true;
    });
  }, [slots, searchQuery, tierFilter]);

  const collapsedSlots = useMemo(() => {
    const seen = new Set<string>();
    const result: GpuSlot[] = [];
    const sorted = [...filteredSlots].sort(
      (a, b) =>
        a.gpu_type.localeCompare(b.gpu_type) ||
        a.service_tier.localeCompare(b.service_tier) ||
        compareRegions(a.region, b.region),
    );
    for (const s of sorted) {
      const key = `${s.gpu_type}|${s.service_tier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(s);
    }
    return result;
  }, [filteredSlots]);

  const slotsByTier = useMemo(() => {
    const map = new Map<string, GpuSlot[]>();
    for (const s of filteredSlots) {
      const k = chartTierKey(s);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [filteredSlots]);

  const groupedByCategory = useMemo(() => {
    const groupMap = new Map<
      string,
      { section: string; productFamily: string; sectionOrder: number; familyOrder: number; slots: GpuSlot[] }
    >();
    for (const slot of collapsedSlots) {
      const cat = getGpuCategory(slot.gpu_type);
      const key = `${cat.section}::${cat.productFamily}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          section: cat.section,
          productFamily: cat.productFamily,
          sectionOrder: cat.sectionOrder,
          familyOrder: cat.familyOrder,
          slots: [],
        });
      }
      groupMap.get(key)!.slots.push(slot);
    }
    const groups = Array.from(groupMap.values());
    for (const g of groups) {
      g.slots.sort((a, b) => slotCompare(a, b, priceSort));
    }
    return groups.sort(
      (a, b) =>
        a.sectionOrder - b.sectionOrder || a.familyOrder - b.familyOrder,
    );
  }, [collapsedSlots, priceSort]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="text-sm text-[var(--text-muted)]">Loading GPU stock…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--error)]/50 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
        {error}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="py-16 text-center text-[var(--text-muted)]">
        No GPU data yet. Ingestion may not have run.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-sans text-lg font-semibold text-[var(--text-primary)]">
            GPU Stock
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
          </p>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          OD = On-Demand · S = Spot
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Search</span>
            <input
              type="text"
              placeholder="Filter by GPU name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>
          <div className="inline-flex overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
              {(["secure", "community"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`cursor-pointer px-3 py-1.5 text-sm capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-deep)] ${
                    tierFilter === tier
                      ? "bg-[var(--accent)] text-[var(--bg-deep)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          <button
            type="button"
            onClick={() => setPriceSort((p) => (p === "asc" ? "desc" : "asc"))}
            className="flex cursor-pointer items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            title={priceSort === "asc" ? "Price low→high (click to reverse)" : "Price high→low (click to reverse)"}
          >
            Price {priceSort === "asc" ? "↑" : "↓"}
          </button>
        </div>
        <span className="ml-auto text-sm text-[var(--text-muted)]">
          {collapsedSlots.length} of {slots.length}
        </span>
      </div>
      <div className="space-y-6">
        {groupedByCategory.map((group, idx) => {
          const prevSection =
            idx > 0 ? groupedByCategory[idx - 1].section : null;
          const showSectionHeader = prevSection !== group.section;
          const docUrl = getProductDocUrl(group.section, group.productFamily);
          return (
            <div key={`${group.section}-${group.productFamily}-${idx}`}>
              {showSectionHeader && (
                <h2 className="mb-2 mt-6 text-base font-semibold text-[var(--text-primary)] first:mt-0">
                  {group.section}
                </h2>
              )}
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {docUrl ? (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer transition-colors hover:text-[var(--text-primary)] hover:underline"
                  >
                    {group.productFamily}
                  </a>
                ) : (
                  group.productFamily
                )}
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-1">
                {group.slots.map((slot) => (
                  <GpuCard
                    key={`${slot.gpu_type}-${slot.service_tier}`}
                    slot={slot}
                    sameTierSlots={slotsByTier.get(chartTierKey(slot)) ?? [slot]}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
