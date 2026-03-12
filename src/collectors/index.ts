import type { GpuSlot } from "./runpod-v1";

export type { GpuSlot };

export interface Collector {
  collect(apiKey: string): Promise<GpuSlot[]>;
}

export { runpodV1, GPU_TYPES_QUERY, flattenGpuTypes } from "./runpod-v1";
