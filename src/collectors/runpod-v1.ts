const RUNPOD_GRAPHQL_URL = "https://api.runpod.io/graphql";
const USER_AGENT = "RunStock/0.1.0 (Cloudflare Workers)";

export const GPU_TYPES_QUERY = `
  query gpuTypes {
    gpuTypes {
      id
      displayName
      manufacturer
      memoryInGb
      cudaCores
      secureCloud
      communityCloud
      securePrice
      communityPrice
      clusterPrice
      secureSpotPrice
      communitySpotPrice
      oneWeekPrice
      oneMonthPrice
      threeMonthPrice
      sixMonthPrice
      maxGpuCount
      maxGpuCountSecureCloud
      maxGpuCountCommunityCloud
      minPodGpuCount
      nodeGroupGpuSizes
      throughput
      lowestPriceSecure: lowestPrice(input: { gpuCount: 1, secureCloud: true, minMemoryInGb: 8, minVcpuCount: 2, minDisk: 0, compliance: [], dataCenterId: "", globalNetwork: false }) {
        gpuName
        gpuTypeId
        minimumBidPrice
        uninterruptablePrice
        minMemory
        minVcpu
        rentalPercentage
        rentedCount
        totalCount
        stockStatus
        minDownload
        minDisk
        minUpload
        countryCode
        supportPublicIp
        compliance
        maxGpuCount
        maxUnreservedGpuCount
        availableGpuCounts
      }
      lowestPriceCommunity: lowestPrice(input: { gpuCount: 1, secureCloud: false, minMemoryInGb: 8, minVcpuCount: 2, minDisk: 0, minDownload: 400, minUpload: 400, supportPublicIp: false }) {
        gpuName
        gpuTypeId
        minimumBidPrice
        uninterruptablePrice
        minMemory
        minVcpu
        rentalPercentage
        rentedCount
        totalCount
        stockStatus
        minDownload
        minDisk
        minUpload
        countryCode
        supportPublicIp
        compliance
        maxGpuCount
        maxUnreservedGpuCount
        availableGpuCounts
      }
      nodeGroupDatacenters {
        id
        name
        location
        globalNetwork
        storageSupport
        listed
        compliance
        gpuAvailability {
          available
          stockStatus
          gpuTypeId
          gpuTypeDisplayName
          displayName
          id
        }
      }
    }
  }
`;

type RunPodGpuAvailability = {
  available: boolean;
  stockStatus: string | null;
  gpuTypeId: string | null;
  gpuTypeDisplayName: string | null;
  displayName: string | null;
  id: string | null;
};

type RunPodDataCenter = {
  id: string;
  name: string;
  location: string;
  globalNetwork: boolean | null;
  storageSupport: boolean | null;
  listed: boolean | null;
  compliance: string[] | null;
  gpuAvailability: RunPodGpuAvailability[] | null;
};

type RunPodLowestPrice = {
  gpuName: string | null;
  gpuTypeId: string | null;
  minimumBidPrice: number | null;
  uninterruptablePrice: number | null;
  minMemory: number | null;
  minVcpu: number | null;
  rentalPercentage: number | null;
  rentedCount: number | null;
  totalCount: number | null;
  stockStatus: string | null;
  minDownload: number | null;
  minDisk: number | null;
  minUpload: number | null;
  countryCode: string | null;
  supportPublicIp: boolean | null;
  compliance: string[] | null;
  maxGpuCount: number | null;
  maxUnreservedGpuCount: number | null;
  availableGpuCounts: number[] | null;
};

type RunPodGpuType = {
  id: string;
  displayName: string | null;
  manufacturer: string | null;
  memoryInGb: number | null;
  cudaCores: number | null;
  secureCloud: boolean;
  communityCloud: boolean;
  securePrice: number | null;
  communityPrice: number | null;
  clusterPrice: number | null;
  secureSpotPrice: number | null;
  communitySpotPrice: number | null;
  oneWeekPrice: number | null;
  oneMonthPrice: number | null;
  threeMonthPrice: number | null;
  sixMonthPrice: number | null;
  maxGpuCount: number | null;
  maxGpuCountSecureCloud: number | null;
  maxGpuCountCommunityCloud: number | null;
  minPodGpuCount: number | null;
  nodeGroupGpuSizes: number[] | null;
  throughput: number | null;
  lowestPriceSecure: RunPodLowestPrice | null;
  lowestPriceCommunity: RunPodLowestPrice | null;
  nodeGroupDatacenters: RunPodDataCenter[];
};

const VCPU_FLOOR_PER_GPU = 4;
const LOWEST_PRICE_COUNTRY = "US";

export type GpuSlot = {
  gpu_type: string;
  gpu_id: string;
  region: string;
  datacenter_id: string | null;
  service_tier: "secure" | "community";
  status: "available" | "unavailable";
  current_price: number;
  spot_price: number | null;
  cluster_price: number | null;
  memory_in_gb: number | null;
  manufacturer: string | null;
  cuda_cores: number | null;
  max_instances: number | null;
  max_gpu_count: number | null;
  min_pod_gpu_count: number | null;
  throughput: number | null;
  one_week_price: number | null;
  one_month_price: number | null;
  three_month_price: number | null;
  six_month_price: number | null;
  node_group_gpu_sizes: number[] | null;
  lowest_price: Record<string, unknown> | null;
  stock_status: string | null;
  min_vcpu: number | null;
  min_memory_gb: number | null;
  min_vcpu_floor: number;
  min_memory_gb_floor: number | null;
  lowest_price_country_code: string;
  us_cheapest_price: number | null;
  us_cheapest_spot: number | null;
  min_disk: number | null;
  min_download: number | null;
  min_upload: number | null;
  available_gpu_counts: number[] | null;
  datacenter_global_network: boolean | null;
  datacenter_storage_support: boolean | null;
  datacenter_listed: boolean | null;
  datacenter_compliance: string[] | null;
  gpu_availability: Record<string, unknown>[] | null;
};

function normalizeRegion(s: string): string {
  return s.trim().toLowerCase() || "global";
}

function normalizeGpuName(gpu: RunPodGpuType): string {
  const d = gpu.displayName?.trim();
  const id = gpu.id?.trim();
  if (d && d !== "unknown") return d;
  if (id && id !== "unknown") return id;
  return "unidentified";
}

function getGpuAvailabilityEntry(
  dc: RunPodDataCenter | null,
  gpuId: string,
  gpuName: string,
): RunPodGpuAvailability | null {
  if (!dc?.gpuAvailability?.length) return null;
  return (
    dc.gpuAvailability.find(
      (a) =>
        (a.gpuTypeId != null && a.gpuTypeId === gpuId) ||
        (a.gpuTypeDisplayName != null && a.gpuTypeDisplayName === gpuName) ||
        (a.displayName != null && a.displayName === gpuName),
    ) ?? null
  );
}

function getAvailabilityForGpu(
  dc: RunPodDataCenter | null,
  gpuId: string,
  gpuName: string,
): boolean {
  const entry = getGpuAvailabilityEntry(dc, gpuId, gpuName);
  if (!entry) return true;
  return entry.available ?? false;
}

function isUnavailableByLowestPrice(lp: RunPodLowestPrice | null | undefined): boolean {
  if (!lp) return false;
  const noStock = lp.maxUnreservedGpuCount === 0;
  const noPrice =
    lp.uninterruptablePrice == null && lp.minimumBidPrice == null;
  return noStock || noPrice;
}

function slotFromGpu(
  gpu: RunPodGpuType,
  gpuName: string,
  region: string,
  dc: RunPodDataCenter | null,
  tier: "secure" | "community",
  status: boolean,
  price: number,
  spotPrice: number | null,
  maxInstances: number | null,
): GpuSlot {
  const lp = tier === "secure" ? gpu.lowestPriceSecure : gpu.lowestPriceCommunity;
  const vramGbRaw = gpu.memoryInGb ?? (gpu as Record<string, unknown>).memory_in_gb ?? null;
  const vramGb = typeof vramGbRaw === "number" ? vramGbRaw : null;
  const availCounts = lp?.availableGpuCounts;
  const availableGpuCounts = Array.isArray(availCounts) ? availCounts : null;
  const dcEntry = getGpuAvailabilityEntry(dc, gpu.id, gpuName);
  const isUnavailable = !status;
  return {
    gpu_type: gpuName,
    gpu_id: gpu.id,
    region,
    datacenter_id: dc?.id ?? null,
    service_tier: tier,
    status: status ? "available" : "unavailable",
    current_price: isUnavailable ? 0 : price,
    spot_price: isUnavailable ? null : spotPrice,
    cluster_price: gpu.clusterPrice ?? null,
    memory_in_gb: vramGb,
    manufacturer: gpu.manufacturer ?? null,
    cuda_cores: gpu.cudaCores ?? null,
    max_instances: maxInstances,
    max_gpu_count: gpu.maxGpuCount ?? null,
    min_pod_gpu_count: gpu.minPodGpuCount ?? null,
    throughput: gpu.throughput ?? null,
    one_week_price: gpu.oneWeekPrice ?? null,
    one_month_price: gpu.oneMonthPrice ?? null,
    three_month_price: gpu.threeMonthPrice ?? null,
    six_month_price: gpu.sixMonthPrice ?? null,
    node_group_gpu_sizes: gpu.nodeGroupGpuSizes ?? null,
    lowest_price: lp ? (lp as unknown as Record<string, unknown>) : null,
    stock_status:
      (lp?.stockStatus as string | null) ??
      (dcEntry?.stockStatus as string | null) ??
      null,
    min_vcpu: lp?.minVcpu != null ? (lp.minVcpu as number) : null,
    min_memory_gb: lp?.minMemory != null ? (lp.minMemory as number) : null,
    min_vcpu_floor: VCPU_FLOOR_PER_GPU,
    min_memory_gb_floor: vramGb != null ? (vramGb as number) : null,
    lowest_price_country_code: (lp?.countryCode as string | null) ?? LOWEST_PRICE_COUNTRY,
    us_cheapest_price: lp?.uninterruptablePrice != null ? (lp.uninterruptablePrice as number) : null,
    us_cheapest_spot: lp?.minimumBidPrice != null ? (lp.minimumBidPrice as number) : null,
    min_disk: lp?.minDisk != null ? (lp.minDisk as number) : null,
    min_download: lp?.minDownload != null ? (lp.minDownload as number) : null,
    min_upload: lp?.minUpload != null ? (lp.minUpload as number) : null,
    available_gpu_counts: availableGpuCounts,
    datacenter_global_network: dc?.globalNetwork ?? null,
    datacenter_storage_support: dc?.storageSupport ?? null,
    datacenter_listed: dc?.listed ?? null,
    datacenter_compliance: dc?.compliance ?? null,
    gpu_availability: dc?.gpuAvailability
      ? (dc.gpuAvailability as unknown as Record<string, unknown>[])
      : null,
  };
}

export function flattenGpuTypes(gpuTypes: RunPodGpuType[]): GpuSlot[] {
  const slots: GpuSlot[] = [];
  for (const gpu of gpuTypes) {
    const gpuName = normalizeGpuName(gpu);
    if (gpuName === "unidentified") continue;

    const dcs = gpu.nodeGroupDatacenters ?? [];
    const regionToDc = new Map<string, RunPodDataCenter>();
    for (const dc of dcs) {
      const raw = (dc.location || dc.name || dc.id || "").trim() || "global";
      const region = normalizeRegion(raw);
      if (!regionToDc.has(region)) regionToDc.set(region, dc);
    }

    const regions =
      regionToDc.size > 0 ? Array.from(regionToDc.keys()) : ["global"];
    const regionsToUse = regions.length > 0 ? regions : ["global"];

    const maxSecure = gpu.maxGpuCountSecureCloud ?? null;
    const maxCommunity = gpu.maxGpuCountCommunityCloud ?? null;

    for (const region of regionsToUse) {
      const dc = regionToDc.get(region) ?? null;
      let available = getAvailabilityForGpu(dc, gpu.id, gpuName);
      if (gpu.secureCloud === true) {
        if (isUnavailableByLowestPrice(gpu.lowestPriceSecure)) available = false;
        slots.push(
          slotFromGpu(
            gpu,
            gpuName,
            region,
            dc,
            "secure",
            available,
            gpu.securePrice ?? 0,
            gpu.secureSpotPrice ?? null,
            maxSecure,
          ),
        );
      }
      if (gpu.communityCloud === true) {
        available = getAvailabilityForGpu(dc, gpu.id, gpuName);
        if (isUnavailableByLowestPrice(gpu.lowestPriceCommunity)) available = false;
        slots.push(
          slotFromGpu(
            gpu,
            gpuName,
            region,
            dc,
            "community",
            available,
            gpu.communityPrice ?? 0,
            gpu.communitySpotPrice ?? null,
            maxCommunity,
          ),
        );
      }
    }
  }
  return slots;
}

export const runpodV1 = {
  async collect(apiKey: string) {
    const res = await fetch(RUNPOD_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: GPU_TYPES_QUERY }),
    });
    if (!res.ok) throw new Error(`RunPod API error: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data?: { gpuTypes?: RunPodGpuType[] }; errors?: unknown[] };
    if (json.errors?.length) throw new Error(`RunPod GraphQL errors: ${JSON.stringify(json.errors)}`);
    return flattenGpuTypes(json.data?.gpuTypes ?? []);
  },
};
