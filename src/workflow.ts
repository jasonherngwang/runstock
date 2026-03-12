import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";
import { runpodV1 } from "./collectors";
import type { GpuSlot } from "./collectors";

export type { GpuSlot } from "./collectors";

type Params = Record<string, never>;

export class IngestionWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(_event: WorkflowEvent<Params>, step: WorkflowStep) {
    const apiKey = this.env.RUNPOD_API_KEY;
    if (!apiKey) {
      throw new Error("RUNPOD_API_KEY secret is not set. Run: pnpm exec wrangler secret put RUNPOD_API_KEY");
    }

    const fetched = await step.do(
      "fetch gpuTypes from RunPod",
      { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } },
      // @ts-expect-error - GpuSlot has Record<string,unknown>; Cloudflare Serializable is strict
      async (): Promise<GpuSlot[]> => runpodV1.collect(apiKey),
    );

    const upserts: GpuSlot[] = Array.isArray(fetched) ? (fetched as GpuSlot[]) : [];

    await step.do("insert price samples for time-series", async () => {
      for (const u of upserts) {
        await this.env.DB.prepare(
          `INSERT OR IGNORE INTO gpu_price_samples (timestamp, gpu_type, region, service_tier, price, spot_price, status)
           VALUES (strftime('%Y-%m-%d %H:%M:00', 'now'), ?, ?, ?, ?, ?, ?)`,
        )
          .bind(u.gpu_type, u.region, u.service_tier, u.current_price, u.spot_price, u.status)
          .run();
      }
      return upserts.length;
    });

    await step.do("broadcast to WebSocket clients", async () => {
      const id = this.env.CONNECTION_MANAGER.idFromName("default");
      const stub = this.env.CONNECTION_MANAGER.get(id);
      const res = await stub.fetch("https://do/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "STOCK_CHANGE",
          payload: { transitions: upserts },
        }),
      });
      if (!res.ok) throw new Error(`Broadcast failed: ${res.status}`);
      return "ok";
    });

    await step.do("write latest state to KV", async () => {
      const payload = {
        updatedAt: new Date().toISOString(),
        slots: upserts,
      };
      await this.env.GPU_STOCK.put("latest", JSON.stringify(payload));
      return "ok";
    });

    const result = { fetched: upserts.length };
    await step.do("log completion", async () => {
      console.log(
        JSON.stringify({
          message: "ingestion workflow completed",
          fetched: result.fetched,
        }),
      );
      return "ok";
    });
    return result;
  }
}
