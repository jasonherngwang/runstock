"use client";

import { memo, useMemo } from "react";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceSample } from "@/lib/api";

type MergedRow = Record<string, string | number | boolean | null>;

export type ChartSeries = {
  label: string;
  data: PriceSample[];
  color: string;
};

/** Downsample to max points. Preserves rows where availability or price changes so short spikes aren't lost. */
const MAX_CHART_POINTS = 400;

function downsample(
  data: MergedRow[],
  maxPoints: number,
  valueKeys: string[],
): MergedRow[] {
  if (data.length <= maxPoints) return data;

  const keepIndices = new Set<number>([0, data.length - 1]);

  for (const key of valueKeys) {
    const unavailKey = key + "_unavailable";
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      const prevUnavail = prev[unavailKey] === true;
      const currUnavail = curr[unavailKey] === true;
      const prevVal = prev[key];
      const currVal = curr[key];
      const prevNum = prevVal != null && typeof prevVal === "number";
      const currNum = currVal != null && typeof currVal === "number";

      if (prevUnavail !== currUnavail) {
        keepIndices.add(i - 1);
        keepIndices.add(i);
      } else if (prevNum && currNum && prevVal !== currVal) {
        keepIndices.add(i - 1);
        keepIndices.add(i);
      }
    }
  }

  let indices = [...keepIndices].sort((a, b) => a - b);

  if (indices.length >= maxPoints) {
    indices = evenSample(indices, maxPoints);
  } else {
    const rest = new Set(
      Array.from({ length: data.length }, (_, i) => i).filter((i) => !keepIndices.has(i)),
    );
    const fillCount = maxPoints - indices.length;
    const fill = evenSample([...rest], Math.min(fillCount, rest.size));
    indices = [...indices, ...fill].sort((a, b) => a - b);
  }

  return indices.map((i) => data[i]);
}

function evenSample(indices: number[], n: number): number[] {
  if (indices.length <= n) return indices;
  const result: number[] = [];
  const step = (indices.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) {
    const j = i === n - 1 ? indices.length - 1 : Math.round(i * step);
    result.push(indices[j]);
  }
  return result;
}

type Props = {
  series: ChartSeries[];
  height?: number;
};

function toLocalDate(ts: string): Date {
  const s = String(ts).trim();
  if (s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s.replace(" ", "T") + "Z");
}

const formatTime = (ts: string) =>
  toLocalDate(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDateTime = (ts: string) =>
  toLocalDate(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPrice = (v: number) => `$${v.toFixed(2)}`;

function ChartTooltipContent({
  active,
  payload,
  label,
  filteredSeries,
  formatDateTime,
}: {
  active?: boolean;
  payload?: { payload?: MergedRow }[];
  label?: string;
  filteredSeries: ChartSeries[];
  formatDateTime: (ts: string) => string;
}) {
  if (!active || !payload?.length || !label || !filteredSeries.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const entries: { label: string; value: string; unavailable: boolean; color: string; sortPrice: number }[] = [];
  for (const s of filteredSeries) {
    const key = toDataKey(s.label);
    const unavail = row[key + "_unavailable"] === true;
    const val = row[key];
    if (val != null && typeof val === "number")
      entries.push({ label: s.label, value: formatPrice(val), unavailable: false, color: s.color, sortPrice: val });
    else if (unavail)
      entries.push({ label: s.label, value: "Unavailable", unavailable: true, color: s.color, sortPrice: -1 });
  }
  entries.sort((a, b) => b.sortPrice - a.sortPrice);
  if (entries.length === 0) return null;
  return (
    <div
      className="px-3 py-2"
      style={{
        background: "rgba(6, 8, 12, 0.75)",
        borderRadius: "6px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      <p className="mb-1.5 text-xs font-medium text-[var(--text-primary)]">
        {formatDateTime(label)}
      </p>
      <div className="flex flex-col gap-0.5">
        {entries.map((e) => (
          <div key={e.label} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: e.color }}
              />
              <span className="text-[var(--text-secondary)]">{e.label}</span>
            </span>
            <span
              className={
                e.unavailable
                  ? "font-semibold text-[var(--error)]"
                  : "font-mono text-[var(--text-primary)]"
              }
            >
              {e.unavailable ? "⚠ Unavailable" : e.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function isUnavailable(d: PriceSample): boolean {
  if (d.status?.toLowerCase().trim() === "unavailable") return true;
  return d.price == null || d.price <= 0;
}

function toDataKey(label: string) {
  return label.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_") || "value";
}

function mergeSeries(series: ChartSeries[]) {
  const timeToRow = new Map<string, MergedRow>();
  for (const { label, data } of series) {
    const key = toDataKey(label);
    const keyUnavail = key + "_unavailable";
    for (const d of data) {
      const t = d.timestamp;
      if (!timeToRow.has(t)) timeToRow.set(t, { time: t });
      const row = timeToRow.get(t)!;
      const unavailable = isUnavailable(d);
      row[keyUnavail] = unavailable;
      row[key] = unavailable ? null : (d.price > 0 ? d.price : null);
    }
  }
  return Array.from(timeToRow.values()).sort(
    (a, b) => toLocalDate(a.time as string).getTime() - toLocalDate(b.time as string).getTime(),
  );
}

const MIN_GAP_MS = 10 * 60 * 1000;

function getGapBridges(
  mergedData: MergedRow[],
  series: ChartSeries[],
): { key: string; points: { time: string; value: number }[] }[] {
  const bridges: { key: string; points: { time: string; value: number }[] }[] = [];

  for (const s of series) {
    const key = toDataKey(s.label);
    const hasData = s.data.some((d) => d.price > 0);
    if (!hasData) continue;

    const dataKey = key;
    let firstValueIdx = -1;
    let lastValueIdx = -1;

    for (let i = 0; i < mergedData.length; i++) {
      const row = mergedData[i];
      const val = row[dataKey];
      const isValue = val != null && typeof val === "number";
      if (isValue) {
        if (firstValueIdx < 0) firstValueIdx = i;
        lastValueIdx = i;
      }
    }
    if (firstValueIdx < 0 || lastValueIdx < 0) continue;

    if (firstValueIdx > 0) {
      const firstRow = mergedData[firstValueIdx];
      const firstVal = firstRow[dataKey] as number;
      bridges.push({
        key: `_gap_${bridges.length}`,
        points: [
          { time: mergedData[0].time as string, value: firstVal },
          { time: firstRow.time as string, value: firstVal },
        ],
      });
    }

    let prevValueIdx = firstValueIdx;
    for (let i = firstValueIdx + 1; i <= lastValueIdx; i++) {
      const row = mergedData[i];
      const val = row[dataKey];
      const isValue = val != null && typeof val === "number";
      if (isValue) {
        const before = mergedData[prevValueIdx];
        const hasNullRowsBetween = i - prevValueIdx > 1;
        const timeDelta =
          toLocalDate(row.time as string).getTime() -
          toLocalDate(before.time as string).getTime();
        const hasTimeGap = timeDelta >= MIN_GAP_MS;
        if (hasNullRowsBetween || hasTimeGap) {
          bridges.push({
            key: `_gap_${bridges.length}`,
            points: [
              { time: before.time as string, value: before[dataKey] as number },
              { time: row.time as string, value: val },
            ],
          });
        }
        prevValueIdx = i;
      }
    }

    if (lastValueIdx < mergedData.length - 1) {
      const lastRow = mergedData[lastValueIdx];
      const lastVal = lastRow[dataKey] as number;
      bridges.push({
        key: `_gap_${bridges.length}`,
        points: [
          { time: lastRow.time as string, value: lastVal },
          { time: mergedData[mergedData.length - 1].time as string, value: lastVal },
        ],
      });
    }
  }
  return bridges;
}

const CHART_COLORS = [
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#8b5cf6",
  "#3b82f6",
  "#14b8a6",
];

export const MAX_CHART_SLOTS = CHART_COLORS.length;

function GpuPriceChartInner({ series, height = 360 }: Props) {
  const filteredSeries = useMemo(
    () =>
      series.filter((s) => s.data.filter((d) => d.price > 0).length >= 2),
    [series],
  );
  if (filteredSeries.length === 0) return null;

  const mergedData = useMemo(() => {
    const full = mergeSeries(filteredSeries);
    const valueKeys = filteredSeries.map((s) => toDataKey(s.label));
    return downsample(full, MAX_CHART_POINTS, valueKeys);
  }, [filteredSeries]);
  const gapBridges = useMemo(
    () => getGapBridges(mergedData, filteredSeries),
    [mergedData, filteredSeries],
  );

  const chartData = useMemo(() => {
    const data = mergedData.map((row) => ({ ...row }));
    const timeToRow = new Map(data.map((r) => [r.time as string, r]));
    for (const bridge of gapBridges) {
      for (const pt of bridge.points) {
        const row = timeToRow.get(pt.time);
        if (row) row[bridge.key] = pt.value;
      }
    }
    return data;
  }, [mergedData, gapBridges]);

  return (
    <div
      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tickCount={6}
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={formatPrice}
            tickCount={5}
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            width={48}
          />
          <Tooltip
            cursor={{
              stroke: "rgba(255,255,255,0.25)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
            contentStyle={{
              background: "transparent",
              border: "none",
              padding: 0,
              boxShadow: "none",
            }}
            wrapperStyle={{ outline: "none" }}
            labelStyle={{ color: "var(--text-primary)" }}
            labelFormatter={formatDateTime}
            content={(props) => (
              <ChartTooltipContent
                {...props}
                filteredSeries={filteredSeries}
                formatDateTime={formatDateTime}
              />
            )}
          />
          {gapBridges.map((b) => (
            <Line
              key={b.key}
              type="monotone"
              dataKey={b.key}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
              connectNulls={true}
              isAnimationActive={false}
              legendType="none"
            />
          ))}
          {filteredSeries.map((s) => (
            <Line
              key={toDataKey(s.label)}
              type="monotone"
              dataKey={toDataKey(s.label)}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 2, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: s.color, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
              legendType="none"
            />
          ))}
          <Brush
            dataKey="time"
            height={28}
            stroke="rgba(255,255,255,0.12)"
            fill="rgba(255,255,255,0.04)"
            travellerWidth={8}
            tickFormatter={() => ""}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const GpuPriceChart = memo(GpuPriceChartInner);

export { CHART_COLORS };
