"use client";

import { useCallback } from "react";
import type { GpuSlot } from "@/lib/api";
import { useChartSelection } from "@/contexts/ChartSelectionContext";
import { displayGpuName } from "@/lib/gpu-family";

function slotKey(s: GpuSlot) {
  return `${s.gpu_type}|${s.region}|${s.service_tier}`;
}

function getAvailabilityDisplay(stockStatus: string | null | undefined): {
  label: string;
  color: string;
  bg: string;
} | null {
  if (!stockStatus?.trim()) return null;
  const normalized = stockStatus.trim().toLowerCase();
  if (normalized.includes("high")) return { label: "High", color: "var(--availability-high)", bg: "rgba(34,197,94,0.15)" };
  if (normalized.includes("medium") || normalized.includes("med")) return { label: "Medium", color: "var(--availability-medium)", bg: "rgba(245,158,11,0.15)" };
  if (normalized.includes("low")) return { label: "Low", color: "var(--availability-low)", bg: "rgba(239,68,68,0.15)" };
  return { label: stockStatus.trim(), color: "var(--text-muted)", bg: "rgba(255,255,255,0.08)" };
}

export function GpuCard({ slot }: { slot: GpuSlot }) {
  const { chartSlots, toggleChartSlot, canAddToChart } = useChartSelection();
  const isSelected = chartSlots.some((s) => slotKey(s) === slotKey(slot));
  const canToggle = isSelected || canAddToChart;

  const handleActivate = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if ("button" in e && e.button !== 0) return;
      if (!canToggle) return;
      toggleChartSlot(slot);
    },
    [slot, toggleChartSlot, canToggle],
  );

  const isAvailable = slot.status === "available" && slot.current_price > 0;
  const statusColor = isAvailable ? "var(--available)" : "var(--unavailable)";

  const availability = isAvailable ? getAvailabilityDisplay(slot.stock_status) : null;

  const specParts: string[] = [];
  if (slot.memory_in_gb != null) specParts.push(`${slot.memory_in_gb}G VRAM`);
  if (slot.min_memory_gb != null) specParts.push(`${Math.round(slot.min_memory_gb)}G RAM`);
  else if (slot.min_memory_gb_floor != null) specParts.push(`${slot.min_memory_gb_floor}G RAM`);
  if (slot.min_vcpu != null) specParts.push(`${Math.round(slot.min_vcpu)} vCPU`);
  else if (slot.min_vcpu_floor != null) specParts.push(`${slot.min_vcpu_floor}+ vCPU`);
  const specStr = specParts.length > 0 ? specParts.join(" · ") : null;

  const priceStr = slot.current_price > 0 ? `$${slot.current_price.toFixed(2)}` : "—";
  const hasSpot = slot.spot_price != null && slot.spot_price > 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onMouseDown={handleActivate}
      onKeyDown={(e) => e.key === "Enter" && handleActivate(e)}
      className={`group flex gap-1.5 rounded border px-2 py-1 text-left transition-all focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${
        isSelected
          ? "cursor-pointer border-[var(--accent)] bg-[var(--accent)]/10 hover:border-[var(--accent)]/40"
          : canToggle
            ? "cursor-pointer border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-elevated)]"
            : "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-surface)] opacity-60"
      }`}
      title={!canToggle ? "Chart full (max 6 GPUs) — remove one to add more" : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1">
            <span
              className="h-1 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: statusColor }}
              title={slot.status}
            />
            <span className="font-mono text-[13px] font-medium text-[var(--text-primary)]">
              {displayGpuName(slot.gpu_type)}
            </span>
            {availability && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium capitalize"
                style={{ color: availability.color, backgroundColor: availability.bg }}
              >
                {availability.label}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right text-[11px]">
            <span className="text-[var(--text-muted)]">OD </span>
            <span className="font-mono font-medium text-[var(--accent)]">{priceStr}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1.5 text-[11px]">
          <span className="text-[var(--text-muted)]">
            {specStr ?? "—"}
          </span>
          {hasSpot ? (
            <span className="shrink-0">
              <span className="text-[var(--text-muted)]">S </span>
              <span className="font-mono font-medium text-[var(--spot-price-muted)]">
                ${slot.spot_price!.toFixed(2)}
              </span>
            </span>
          ) : (
            <span />
          )}
        </div>
      </div>
    </article>
  );
}
