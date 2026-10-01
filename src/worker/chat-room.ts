import { DurableObject } from "cloudflare:workers";
import type { AppEnv } from "./types";

type Attachment = { userId: string };

export type ChatEvent =
	| {
			type: "message";
			message: { id: string; senderId: string; body: string; createdAt: number; clientId?: string };
	  }
	| { type: "presence"; online: string[] }
	| { type: "typing"; userId: string }
	| { type: "read"; userId: string; at: number }
	| { type: "blocked"; by: string };

/**
 * One instance per conversation (named by conversation id), in the spirit of
 * Cloudflare's realtime chat tutorial, using the WebSocket Hibernation API so
 * idle rooms cost nothing. The Worker authenticates the user, stores messages
 * in D1, then calls `broadcast()` here to fan events out to open sockets.
 */
export class ChatRoom extends DurableObject<AppEnv> {
	constructor(ctx: DurableObjectState, env: AppEnv) {
		super(ctx, env);
		// Answered by the runtime without waking the object.
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
	}

	async fetch(request: Request): Promise<Response> {
		const userId = request.headers.get("x-user-id");
		if (!userId) return new Response("Missing user", { status: 400 });
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected a WebSocket upgrade", { status: 426 });
		}

		const [client, server] = Object.values(new WebSocketPair());
		this.ctx.acceptWebSocket(server, [userId]);
		server.serializeAttachment({ userId } satisfies Attachment);
		this.sendPresence();
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		if (typeof raw !== "string" || raw.length > 512) return;
		let data: { type?: string };
		try {
			data = JSON.parse(raw);
		} catch {
			return;
		}
		const { userId } = ws.deserializeAttachment() as Attachment;
		// Clients only send ephemeral signals; messages go through the HTTP API so they're persisted first.
		if (data.type === "typing") this.broadcast({ type: "typing", userId }, ws);
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		ws.close(code, reason);
		this.sendPresence(ws);
	}

	async webSocketError(ws: WebSocket) {
		this.sendPresence(ws);
	}

	/** Called by the Worker over RPC. `except` skips one socket (e.g. the typer). */
	broadcast(event: ChatEvent, except?: WebSocket) {
		const payload = JSON.stringify(event);
		for (const ws of this.ctx.getWebSockets()) {
			if (ws === except) continue;
			try {
				ws.send(payload);
			} catch {
				// Socket already closing; presence will catch up.
			}
		}
	}

	/** Drops every socket, e.g. after a block. */
	closeAll(reason: string) {
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.close(4003, reason);
			} catch {
				// ignore
			}
		}
	}

	private sendPresence(leaving?: WebSocket) {
		const online = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			if (ws === leaving || ws.readyState !== WebSocket.OPEN) continue;
			for (const tag of this.ctx.getTags(ws)) online.add(tag);
		}
		this.broadcast({ type: "presence", online: [...online] }, leaving);
	}
}
