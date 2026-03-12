import { Hono } from "hono";
import { ConnectionManager } from "./connection-manager";
import { IngestionWorkflow } from "./workflow";

const ALLOWED_ORIGINS = [
  "https://runstock.vercel.app",
  "https://www.runstock.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control",
    "Access-Control-Max-Age": "86400",
  };
}

function withCors(res: Response, req: Request): Response {
  const origin = req.headers.get("Origin");
  const cors = getCorsHeaders(origin);
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

const app = new Hono<{ Bindings: Env }>();
app.get("/", (c) => c.text("RunStock API"));

export { ConnectionManager, IngestionWorkflow };

const GENERIC_ERROR = "An error occurred. Please try again later.";

async function handleFetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("Origin");
    const cors = getCorsHeaders(origin);
    return new Response(null, { status: 204, headers: cors });
  }
  const url = new URL(req.url);

  if (url.pathname === "/api/v1/ws" && req.method === "GET") {
    if (req.headers.get("Upgrade") !== "websocket") {
      return withCors(Response.json({ error: "Expected WebSocket upgrade" }, { status: 426 }), req);
    }
    const do_ = env.CONNECTION_MANAGER;
    if (!do_) {
      return withCors(Response.json({ error: "WebSocket endpoint not available" }, { status: 503 }), req);
    }
    const id = do_.idFromName("default");
    const stub = do_.get(id);
    const res = await stub.fetch(req);
    if (res.status === 101 && (res as Response & { webSocket?: WebSocket }).webSocket) {
      const origin = req.headers.get("Origin");
      const cors = getCorsHeaders(origin);
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      return new Response(null, {
        status: 101,
        headers: h,
        webSocket: (res as Response & { webSocket: WebSocket }).webSocket,
      });
    }
    return withCors(res, req);
  }

  if (url.pathname === "/api/v1/history/series/aggregate" && req.method === "GET") {
    const db = env.DB;
    if (!db) {
      return withCors(Response.json({ error: "Database not available" }, { status: 503 }), req);
    }
    const urlObj = new URL(req.url);
    const gpuType = urlObj.searchParams.get("gpu_type") ?? "";
    const serviceTier = urlObj.searchParams.get("service_tier") ?? "";
    const rawHours = parseFloat(urlObj.searchParams.get("hours") ?? "48") || 48;
    const hours = Math.max(1, Math.min(rawHours, 168));
    if (!gpuType || !serviceTier) {
      return withCors(
        Response.json({ error: "gpu_type and service_tier are required" }, { status: 400 }),
        req,
      );
    }
    try {
      const { results } = await db.prepare(
        `SELECT timestamp, region, price, spot_price, status
         FROM gpu_price_samples
         WHERE gpu_type = ? AND service_tier = ?
           AND timestamp >= datetime('now', ?)
         ORDER BY timestamp ASC`,
      )
        .bind(gpuType, serviceTier, `-${hours} hours`)
        .all();
      const rows = (results ?? []) as {
        timestamp: string;
        region: string;
        price: number;
        spot_price: number | null;
        status: string;
      }[];
      const byTime = new Map<string, { price: number; spot_price: number | null; status: string }[]>();
      for (const r of rows) {
        const t = r.timestamp;
        if (!byTime.has(t)) byTime.set(t, []);
        byTime.get(t)!.push({
          price: r.price,
          spot_price: r.spot_price,
          status: r.status ?? "",
        });
      }
      const data = Array.from(byTime.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([timestamp, entries]) => {
          const available = entries.find(
            (e) =>
              e.price > 0 &&
              (e.status?.toLowerCase().trim() !== "unavailable"),
          );
          const best = available ?? entries[0];
          return {
            timestamp,
            price: best?.price ?? 0,
            spot_price: best?.spot_price ?? null,
            status: best?.status ?? "unavailable",
          };
        });
      return withCors(
        Response.json({ data }, { headers: { "Cache-Control": "public, max-age=30" } }),
        req,
      );
    } catch (err) {
      console.error("History series aggregate error:", err);
      return withCors(Response.json({ error: GENERIC_ERROR }, { status: 500 }), req);
    }
  }

  if (url.pathname === "/api/v1/history/series" && req.method === "GET") {
    const db = env.DB;
    if (!db) {
      return withCors(Response.json({ error: "Database not available" }, { status: 503 }), req);
    }
    const urlObj = new URL(req.url);
    const gpuType = urlObj.searchParams.get("gpu_type") ?? "";
    const region = urlObj.searchParams.get("region") ?? "";
    const serviceTier = urlObj.searchParams.get("service_tier") ?? "";
    const rawHours = parseFloat(urlObj.searchParams.get("hours") ?? "48") || 48;
    const hours = Math.max(1, Math.min(rawHours, 168));
    if (!gpuType || !region || !serviceTier) {
      return withCors(
        Response.json({ error: "gpu_type, region, and service_tier are required" }, { status: 400 }),
        req,
      );
    }
    try {
      const { results } = await db.prepare(
        `SELECT timestamp, price, spot_price, status
         FROM gpu_price_samples
         WHERE gpu_type = ? AND region = ? AND service_tier = ?
           AND timestamp >= datetime('now', ?)
         ORDER BY timestamp ASC`,
      )
        .bind(gpuType, region, serviceTier, `-${hours} hours`)
        .all();
      const data = (results ?? []) as { timestamp: string; price: number; spot_price: number | null; status: string }[];
      return withCors(
        Response.json({ data }, { headers: { "Cache-Control": "public, max-age=30" } }),
        req,
      );
    } catch (err) {
      console.error("History series error:", err);
      return withCors(Response.json({ error: GENERIC_ERROR }, { status: 500 }), req);
    }
  }

  if (url.pathname === "/api/v1/stock" && req.method === "GET") {
    const kv = env.GPU_STOCK;
    if (!kv) {
      return withCors(
        Response.json(
          { error: "No stock data yet. Ingestion may not have run." },
          { status: 404 },
        ),
        req,
      );
    }
    const value = await kv.get("latest");
    if (!value) {
      return withCors(
        Response.json(
          { error: "No stock data yet. Ingestion may not have run." },
          { status: 404 },
        ),
        req,
      );
    }
    const data = JSON.parse(value) as Record<string, unknown>;
    const res = Response.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
    return withCors(res, req);
  }

  const res = await app.fetch(req, env, ctx);
  return withCors(res, req);
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    handleFetch(req, env, ctx),
  scheduled: async (
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ) => {
    const instance = await env.INGESTION_WORKFLOW.create();
    console.log(
      JSON.stringify({
        message: "ingestion workflow triggered",
        instanceId: instance.id,
      }),
    );
  },
};
