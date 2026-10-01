import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Dices, Loader2, MoreVertical, SendHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BlobAvatar, EmptyState, Sticker } from "@/components/brand";
import { useChatSocket, type SocketEvent } from "@/hooks/use-chat-socket";
import { api, errorMessage } from "@/lib/api";
import type { ChatDetail, ChatMessage } from "@/lib/types";

function formatTime(ts: number) {
	return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayLabel(ts: number) {
	const d = new Date(ts);
	const today = new Date();
	const yesterday = new Date(Date.now() - 86_400_000);
	if (d.toDateString() === today.toDateString()) return "Today";
	if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
	return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function ChatRoomPage() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const fromDeck = (location.state as { fromDeck?: string } | null)?.fromDeck;
	const queryClient = useQueryClient();
	const key = ["chat", id];

	const detail = useQuery({
		queryKey: key,
		queryFn: () => api<ChatDetail>(`/chats/${id}`),
		retry: false,
	});

	const [online, setOnline] = useState<string[]>([]);
	const [typingAt, setTypingAt] = useState(0);
	const [draft, setDraft] = useState("");
	const [draftIsOpener, setDraftIsOpener] = useState(false);
	const [blockOpen, setBlockOpen] = useState(false);
	const [now, setNow] = useState(() => Date.now());

	const myId = detail.data?.me.id;
	const otherId = detail.data?.other.id;

	const markRead = useMutation({
		mutationFn: () => api(`/chats/${id}/read`, { method: "POST" }),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chats"] }),
	});

	const { status, sendTyping } = useChatSocket(detail.data ? id : undefined, (event: SocketEvent) => {
		if (event.type === "message") {
			queryClient.setQueryData<ChatDetail>(key, (prev) => {
				if (!prev) return prev;
				const next = mergeMessage(prev, event.message);
				// Replying means they've read everything before it.
				if (event.message.senderId !== prev.me.id) {
					const read = Math.max(prev.chat.otherLastReadAt ?? 0, event.message.createdAt);
					return { ...next, chat: { ...next.chat, otherLastReadAt: read } };
				}
				return next;
			});
			if (event.message.senderId !== myId) {
				setTypingAt(0);
				if (document.visibilityState === "visible") markRead.mutate();
			}
		} else if (event.type === "presence") {
			setOnline(event.online);
		} else if (event.type === "typing" && event.userId !== myId) {
			setTypingAt(Date.now());
		} else if (event.type === "read" && event.userId === otherId) {
			queryClient.setQueryData<ChatDetail>(key, (prev) =>
				prev ? { ...prev, chat: { ...prev.chat, otherLastReadAt: event.at } } : prev,
			);
		} else if (event.type === "blocked") {
			void queryClient.invalidateQueries({ queryKey: ["chats"] });
			if (event.by !== myId) {
				toast("This chat has ended.");
				navigate("/chats", { replace: true });
			}
		}
	});

	// After a reconnect, refetch so anything sent while we were offline shows up.
	const wasOpen = useRef(false);
	useEffect(() => {
		if (status !== "open") return;
		if (wasOpen.current) void queryClient.invalidateQueries({ queryKey: key });
		wasOpen.current = true;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status]);

	// Re-render once a second while someone is typing so the indicator expires.
	useEffect(() => {
		if (!typingAt) return;
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, [typingAt]);
	const theyAreTyping = typingAt > 0 && now - typingAt < 4000;

	// Mark as read when opening the chat.
	useEffect(() => {
		if (detail.data) markRead.mutate();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id, Boolean(detail.data)]);

	const iHaveWritten = detail.data?.messages.some((m) => m.senderId === myId) ?? false;
	// Suggest an opener only to start a conversation, not when replying to one.
	const wantsOpener = Boolean(
		detail.data &&
			!iHaveWritten &&
			!detail.data.chat.blockedByMe &&
			(!detail.data.chat.theySwipedFirst || detail.data.messages.length === 0),
	);

	const opener = useQuery({
		queryKey: ["opener", id],
		queryFn: () => api<{ text: string; source: "ai" | "template" }>(`/chats/${id}/opener`),
		enabled: wantsOpener,
		staleTime: Infinity,
	});

	// Prefill the composer with the suggested opener (once per suggestion).
	const lastOpener = useRef<string | null>(null);
	useEffect(() => {
		if (opener.data && opener.data.text !== lastOpener.current && (draft === "" || draftIsOpener)) {
			lastOpener.current = opener.data.text;
			setDraft(opener.data.text);
			setDraftIsOpener(true);
		}
	}, [opener.data, draft, draftIsOpener]);

	const send = useMutation({
		mutationFn: (msg: { body: string; clientId: string }) =>
			api<{ message: ChatMessage }>(`/chats/${id}/messages`, { method: "POST", body: msg }),
		onMutate: (msg) => {
			queryClient.setQueryData<ChatDetail>(key, (prev) =>
				prev
					? mergeMessage(prev, {
							id: `pending-${msg.clientId}`,
							clientId: msg.clientId,
							senderId: prev.me.id,
							body: msg.body,
							createdAt: Date.now(),
							pending: true,
						})
					: prev,
			);
		},
		onSuccess: ({ message }, msg) => {
			queryClient.setQueryData<ChatDetail>(key, (prev) => (prev ? mergeMessage(prev, { ...message, clientId: msg.clientId }) : prev));
			void queryClient.invalidateQueries({ queryKey: ["chats"] });
		},
		onError: (e, msg) => {
			queryClient.setQueryData<ChatDetail>(key, (prev) =>
				prev ? { ...prev, messages: prev.messages.filter((m) => m.clientId !== msg.clientId) } : prev,
			);
			setDraft(msg.body);
			toast.error(errorMessage(e));
		},
	});

	const block = useMutation({
		mutationFn: (reason: string) =>
			api("/blocks", { method: "POST", body: { userId: otherId, conversationId: id, reason: reason || undefined } }),
		onSuccess: () => {
			toast.success("Blocked. They can't see you or message you anymore.");
			void queryClient.invalidateQueries({ queryKey: ["chats"] });
			navigate("/chats", { replace: true });
		},
		onError: (e) => toast.error(errorMessage(e)),
	});

	// Keep the newest message in view.
	const scroller = useRef<HTMLDivElement>(null);
	const messageCount = detail.data?.messages.length ?? 0;
	useLayoutEffect(() => {
		const el = scroller.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messageCount, theyAreTyping]);

	if (detail.isPending) {
		return (
			<div className="flex h-dvh flex-col gap-4 p-4 lg:h-full">
				<Skeleton className="h-14 rounded-2xl" />
				<Skeleton className="flex-1 rounded-3xl" />
			</div>
		);
	}
	if (detail.isError) {
		return (
			<EmptyState
				emoji="🫥"
				title="This chat isn't available"
				action={
					<Button asChild>
						<Link to="/chats">Back to chats</Link>
					</Button>
				}
			>
				{errorMessage(detail.error)}
			</EmptyState>
		);
	}

	const { chat, other, messages } = detail.data;
	const isOnline = online.includes(other.id);
	const lastMine = [...messages].reverse().find((m) => m.senderId === myId && !m.pending);
	const seen = lastMine && chat.otherLastReadAt !== null && chat.otherLastReadAt >= lastMine.createdAt;

	function submit() {
		const body = draft.trim();
		if (!body || send.isPending) return;
		setDraft("");
		setDraftIsOpener(false);
		send.mutate({ body, clientId: crypto.randomUUID() });
	}

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-paper lg:static lg:z-auto lg:h-full lg:overflow-hidden lg:rounded-[2rem] lg:border-2 lg:border-ink lg:bg-card lg:shadow-pop">
			{/* Header */}
			<header className="flex items-center gap-3 border-b-2 border-ink bg-card px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Back"
					className="lg:hidden"
					onClick={() => navigate(fromDeck ?? "/chats")}
				>
					<ArrowLeft />
				</Button>
				<div className="relative">
					<BlobAvatar handle={other.handle} />
					<span
						className={cn(
							"absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-ink",
							isOnline ? "bg-mint" : "bg-muted",
						)}
						aria-label={isOnline ? "Online" : "Offline"}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate font-display text-lg leading-tight font-extrabold" data-testid="chat-handle">
						{other.handle}
					</p>
					<p className="truncate text-xs text-muted-foreground" data-testid="chat-meta">
						{[other.age ? `${other.age} yrs` : null, other.suburb, isOnline ? "online now" : null]
							.filter(Boolean)
							.join(" · ")}
					</p>
				</div>
				{fromDeck && (
					<Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
						<Link to={fromDeck}>Back to deck</Link>
					</Button>
				)}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" aria-label="Chat options">
							<MoreVertical />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="rounded-2xl border-2 border-ink shadow-pop-sm">
						<DropdownMenuItem className="font-semibold text-destructive" onSelect={() => setBlockOpen(true)}>
							<Ban /> Block {other.handle}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</header>

			{/* Messages */}
			<div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain bg-dots px-3 py-4 sm:px-6">
				<div className="mx-auto flex max-w-2xl flex-col gap-2">
					<ContextCard detail={detail.data} />
					{chat.theySwipedFirst && messages.length === 0 && (
						<p className="my-4 text-center text-sm text-muted-foreground">
							They swiped right on you but haven't written yet. Nothing stops you from going first 😉
						</p>
					)}
					{messages.map((m, i) => {
						const mine = m.senderId === myId;
						const prev = messages[i - 1];
						const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
						return (
							<div key={m.clientId ?? m.id} className="flex flex-col">
								{newDay && (
									<span className="my-3 self-center rounded-full border-2 border-ink bg-card px-3 py-0.5 text-xs font-bold">
										{dayLabel(m.createdAt)}
									</span>
								)}
								<div
									data-testid={mine ? "msg-mine" : "msg-theirs"}
									className={cn(
										"max-w-[82%] rounded-3xl border-2 border-ink px-4 py-2.5 text-[15px] leading-snug break-words whitespace-pre-wrap",
										mine
											? "self-end rounded-br-md bg-coral text-white"
											: "self-start rounded-bl-md bg-peach text-ink",
										m.pending && "opacity-60",
									)}
								>
									{m.body}
									<span className={cn("mt-1 block text-[10px]", mine ? "text-white/80" : "text-muted-foreground")}>
										{formatTime(m.createdAt)}
									</span>
								</div>
							</div>
						);
					})}
					{seen && (
						<span className="self-end pr-1 text-xs font-semibold text-muted-foreground" data-testid="seen">
							Seen
						</span>
					)}
					{theyAreTyping && (
						<div className="flex gap-1 self-start rounded-3xl rounded-bl-md border-2 border-ink bg-peach px-4 py-3" aria-label="Typing">
							{[0, 1, 2].map((d) => (
								<span
									key={d}
									className="size-2 rounded-full bg-ink"
									style={{ animation: `typing-bounce 1s ${d * 0.15}s infinite` }}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Composer */}
			{chat.blockedByMe ? (
				<div className="border-t-2 border-ink bg-card p-4 text-center text-sm font-semibold">
					You blocked this person.
				</div>
			) : (
				<form
					className="border-t-2 border-ink bg-card px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
					onSubmit={(e) => {
						e.preventDefault();
						submit();
					}}
				>
					{wantsOpener && (
						<div className="mb-2 flex items-center justify-between gap-2">
							<span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
								<Sparkles className="size-3.5 text-grape" />
								{opener.isFetching ? "Cooking up an opener…" : "Suggested opener — edit it or send as is"}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="xs"
								disabled={opener.isFetching}
								onClick={() => {
									setDraftIsOpener(true);
									void queryClient.invalidateQueries({ queryKey: ["opener", id] });
								}}
							>
								<Dices /> Another idea
							</Button>
						</div>
					)}
					<div className="flex items-end gap-2">
						<Textarea
							value={draft}
							onChange={(e) => {
								setDraft(e.target.value);
								setDraftIsOpener(false);
								sendTyping();
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
									e.preventDefault();
									submit();
								}
							}}
							placeholder="Write something nice…"
							maxLength={1000}
							rows={1}
							aria-label="Message"
							className="max-h-36 min-h-12 resize-none"
						/>
						<Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()}>
							{send.isPending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
						</Button>
					</div>
					{status !== "open" && (
						<p className="mt-1 text-center text-[11px] text-muted-foreground">
							{status === "connecting" ? "Connecting…" : "Reconnecting… messages still send."}
						</p>
					)}
				</form>
			)}

			<BlockDialog
				open={blockOpen}
				onOpenChange={setBlockOpen}
				handle={other.handle}
				pending={block.isPending}
				onConfirm={(reason) => block.mutate(reason)}
			/>
		</div>
	);
}

function mergeMessage(prev: ChatDetail, incoming: ChatMessage): ChatDetail {
	const idx = prev.messages.findIndex(
		(m) => m.id === incoming.id || (incoming.clientId !== undefined && m.clientId === incoming.clientId),
	);
	if (idx >= 0) {
		const messages = [...prev.messages];
		messages[idx] = { ...messages[idx], ...incoming, pending: incoming.pending ?? false };
		return { ...prev, messages };
	}
	return { ...prev, messages: [...prev.messages, incoming] };
}

function ContextCard({ detail }: { detail: ChatDetail }) {
	const { chat, other } = detail;
	return (
		<div className="mx-auto mb-4 w-full max-w-md rounded-3xl bg-lilac p-4 pop-sm">
			<div className="flex flex-wrap items-center gap-2">
				{chat.subcategory && (
					<Sticker tone="paper" tilt={-2}>
						{chat.subcategory.emoji} {chat.subcategory.name}
					</Sticker>
				)}
				<span className="text-xs font-semibold text-muted-foreground">
					{chat.theySwipedFirst ? "They said hi to you" : "You said hi"}
				</span>
			</div>
			{other.summary && <p className="mt-3 font-display text-base leading-snug font-semibold">“{other.summary}”</p>}
			<p className="mt-2 text-xs text-muted-foreground">
				🔓 Age unlocked: {other.age ?? "?"} · Keep it kind. No photos or numbers needed.
			</p>
		</div>
	);
}

function BlockDialog({
	open,
	onOpenChange,
	handle,
	pending,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	handle: string;
	pending: boolean;
	onConfirm: (reason: string) => void;
}) {
	const [reason, setReason] = useState("");
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="rounded-3xl border-2 border-ink shadow-pop-lg">
				<AlertDialogHeader>
					<AlertDialogTitle className="font-display text-2xl font-extrabold">Block {handle}?</AlertDialogTitle>
					<AlertDialogDescription>
						They won't be able to message you or see you in any deck. This chat disappears for both of you.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Textarea
					placeholder="What happened? (optional — only the Ghulo Milo team sees this)"
					value={reason}
					maxLength={500}
					onChange={(e) => setReason(e.target.value)}
				/>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<Button variant="destructive" disabled={pending} onClick={() => onConfirm(reason)}>
						{pending && <Loader2 className="animate-spin" />} Block
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
