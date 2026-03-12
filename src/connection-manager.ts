import { DurableObject } from "cloudflare:workers";

export class ConnectionManager extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const body = await request.json<{ type: string; payload: unknown }>().catch(() => null);
      const payload = body ?? { type: "STOCK_CHANGE", payload: {} };
      const message = JSON.stringify(
        typeof payload === "object" && payload !== null && "type" in payload
          ? payload
          : { type: "STOCK_CHANGE", payload },
      );
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(message);
        } catch {}
      }
      return Response.json({ broadcast: "ok", clients: this.ctx.getWebSockets().length });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {}

  webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): void {
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(code, reason);
      }
    } catch {
    }
  }
}
