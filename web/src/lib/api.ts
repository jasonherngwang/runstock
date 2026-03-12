const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787")
    : "http://localhost:8787";

export type GpuSlot = {
  gpu_type: string;
  gpu_id?: string;
  region: string;
  datacenter_id?: string | null;
  service_tier: "secure" | "community";
  status: "available" | "unavailable";
  current_price: number;
  spot_price?: number | null;
  cluster_price?: number | null;
  memory_in_gb?: number | null;
  manufacturer?: string | null;
  cuda_cores?: number | null;
  max_instances?: number | null;
  max_gpu_count?: number | null;
  min_pod_gpu_count?: number | null;
  throughput?: number | null;
  one_week_price?: number | null;
  one_month_price?: number | null;
  three_month_price?: number | null;
  six_month_price?: number | null;
  node_group_gpu_sizes?: number[] | null;
  lowest_price?: Record<string, unknown> | null;
  stock_status?: string | null;
  min_vcpu?: number | null;
  min_memory_gb?: number | null;
  min_vcpu_floor?: number;
  min_memory_gb_floor?: number | null;
  lowest_price_country_code?: string;
  us_cheapest_price?: number | null;
  us_cheapest_spot?: number | null;
  min_disk?: number | null;
  min_download?: number | null;
  min_upload?: number | null;
  available_gpu_counts?: number[] | null;
  datacenter_global_network?: boolean | null;
  datacenter_storage_support?: boolean | null;
  datacenter_listed?: boolean | null;
  datacenter_compliance?: string[] | null;
  gpu_availability?: Record<string, unknown>[] | null;
};

export type StockResponse = {
  updatedAt: string;
  slots: GpuSlot[];
};

export async function fetchStock(): Promise<StockResponse> {
  const res = await fetch(`${API_BASE}/api/v1/stock`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type PriceSample = {
  timestamp: string;
  price: number;
  spot_price: number | null;
  status: string;
};

export type SeriesResponse = { data: PriceSample[] };

export async function fetchSeries(params: {
  gpu_type: string;
  region: string;
  service_tier: string;
  hours?: number;
}): Promise<SeriesResponse> {
  const sp = new URLSearchParams({
    gpu_type: params.gpu_type,
    region: params.region,
    service_tier: params.service_tier,
  });
  if (params.hours != null) sp.set("hours", String(params.hours));
  const res = await fetch(`${API_BASE}/api/v1/history/series?${sp}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function getWebSocketUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  const ws = base.replace(/^http/, "ws");
  return `${ws}/api/v1/ws`;
}
