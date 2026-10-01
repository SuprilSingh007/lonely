import { useEffect, useRef, useState } from "react";

export type SocketEvent =
	| { type: "message"; message: { id: string; senderId: string; body: string; createdAt: number; clientId?: string } }
	| { type: "presence"; online: string[] }
	| { type: "typing"; userId: string }
	| { type: "read"; userId: string; at: number }
	| { type: "blocked"; by: string };

type Status = "connecting" | "open" | "closed";

/**
 * Live connection to the conversation's ChatRoom Durable Object.
 * Reconnects with backoff; a 4003 close (blocked) is final.
 */
export function useChatSocket(chatId: string | undefined, onEvent: (event: SocketEvent) => void) {
	const [status, setStatus] = useState<Status>("connecting");
	const handler = useRef(onEvent);
	const socket = useRef<WebSocket | null>(null);

	useEffect(() => {
		handler.current = onEvent;
	});

	useEffect(() => {
		if (!chatId) return;
		let stopped = false;
		let attempt = 0;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let pingTimer: ReturnType<typeof setInterval> | undefined;

		const connect = () => {
			setStatus("connecting");
			const protocol = location.protocol === "https:" ? "wss" : "ws";
			const ws = new WebSocket(`${protocol}://${location.host}/api/chats/${chatId}/ws`);
			socket.current = ws;

			ws.onopen = () => {
				attempt = 0;
				setStatus("open");
				// The Durable Object auto-replies "pong" without waking up.
				pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 25_000);
			};
			ws.onmessage = (e) => {
				if (e.data === "pong") return;
				try {
					handler.current(JSON.parse(e.data as string) as SocketEvent);
				} catch {
					// ignore malformed frames
				}
			};
			ws.onclose = (e) => {
				clearInterval(pingTimer);
				socket.current = null;
				setStatus("closed");
				if (stopped || e.code === 4003) return;
				attempt += 1;
				retryTimer = setTimeout(connect, Math.min(15_000, 500 * 2 ** attempt));
			};
		};

		connect();
		const onOnline = () => {
			if (!socket.current) {
				clearTimeout(retryTimer);
				connect();
			}
		};
		window.addEventListener("online", onOnline);

		return () => {
			stopped = true;
			clearTimeout(retryTimer);
			clearInterval(pingTimer);
			window.removeEventListener("online", onOnline);
			socket.current?.close(1000, "leaving");
		};
	}, [chatId]);

	const lastTyping = useRef(0);
	function sendTyping() {
		const now = Date.now();
		if (now - lastTyping.current < 2500) return;
		lastTyping.current = now;
		if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: "typing" }));
	}

	return { status, sendTyping };
}
