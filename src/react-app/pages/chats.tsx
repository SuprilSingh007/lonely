import { Link, Outlet, useMatch } from "react-router";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BlobAvatar, EmptyState, PageHeader } from "@/components/brand";
import { useChats } from "@/hooks/use-app-data";
import type { ChatListItem } from "@/lib/types";

function timeAgo(ts: number) {
	const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
	if (s < 60) return "now";
	if (s < 3600) return `${Math.floor(s / 60)}m`;
	if (s < 86400) return `${Math.floor(s / 3600)}h`;
	if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
	return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** List + conversation. Mobile shows one at a time; desktop shows both side by side. */
export function ChatsLayout() {
	const room = useMatch("/chats/:id");
	return (
		<div className="lg:grid lg:h-[calc(100dvh-5rem)] lg:grid-cols-[340px_1fr] lg:gap-6">
			<div className={cn("min-h-0 flex-col gap-5", room ? "hidden lg:flex" : "flex")}>
				<PageHeader kicker="People who said hi, and people you said hi to" title="Chats" />
				<ChatList activeId={room?.params.id} />
			</div>
			<div className={cn("min-h-0", room ? "block" : "hidden lg:block")}>
				<Outlet />
			</div>
		</div>
	);
}

export function ChatsIndexPane() {
	return (
		<div className="grid h-full place-items-center rounded-[2rem] border-2 border-dashed border-ink bg-card/60">
			<EmptyState emoji="💬" title="Pick a chat">
				Or head to Discover and say hi to someone new.
			</EmptyState>
		</div>
	);
}

function ChatList({ activeId }: { activeId?: string }) {
	const chats = useChats();

	if (chats.isPending) {
		return (
			<div className="flex flex-col gap-3">
				{Array.from({ length: 4 }, (_, i) => (
					<Skeleton key={i} className="h-20 rounded-3xl" />
				))}
			</div>
		);
	}

	const list = chats.data?.chats ?? [];
	if (list.length === 0) {
		return (
			<EmptyState
				emoji="🦗"
				title="Crickets… for now"
				action={
					<Button asChild>
						<Link to="/discover">Find someone to say hi to</Link>
					</Button>
				}
			>
				When you swipe right a chat opens here. When someone swipes right on you, you'll see them here too.
			</EmptyState>
		);
	}

	const newHellos = list.filter((c) => c.theySwipedFirst && !c.lastMessage);
	const rest = list.filter((c) => !(c.theySwipedFirst && !c.lastMessage));

	return (
		<div className="flex min-h-0 flex-col gap-5 lg:overflow-y-auto lg:pr-2 lg:pb-2">
			{newHellos.length > 0 && (
				<section className="flex flex-col gap-2">
					<h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
						Swiped right on you ({newHellos.length})
					</h2>
					<div className="flex gap-3 overflow-x-auto pb-2">
						{newHellos.map((c) => (
							<Link
								key={c.id}
								to={`/chats/${c.id}`}
								className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-3xl bg-lilac p-3 text-center pop-sm pressable"
							>
								<BlobAvatar handle={c.other.handle} className="size-12" />
								<span className="line-clamp-2 text-xs leading-tight font-bold">{c.other.handle}</span>
								<span className="text-lg">{c.subcategory.emoji}</span>
							</Link>
						))}
					</div>
				</section>
			)}
			<ul className="flex flex-col gap-3" data-testid="chat-list">
				{rest.map((c) => (
					<li key={c.id}>
						<ChatRow chat={c} active={c.id === activeId} />
					</li>
				))}
			</ul>
		</div>
	);
}

function ChatRow({ chat, active }: { chat: ChatListItem; active: boolean }) {
	return (
		<Link
			to={`/chats/${chat.id}`}
			className={cn(
				"flex items-center gap-3 rounded-3xl border-2 border-ink p-3 pr-4 pressable",
				active ? "bg-peach shadow-pop-sm" : "bg-card hover:bg-paper",
			)}
		>
			<BlobAvatar handle={chat.other.handle} />
			<div className="min-w-0 flex-1">
				<div className="flex items-baseline justify-between gap-2">
					<p className={cn("truncate font-display text-base", chat.unread ? "font-extrabold" : "font-bold")}>
						{chat.other.handle}
					</p>
					<span className="shrink-0 text-xs text-muted-foreground">{timeAgo(chat.activityAt)}</span>
				</div>
				<p className={cn("truncate text-sm", chat.unread ? "font-semibold text-ink" : "text-muted-foreground")}>
					{chat.lastMessage
						? `${chat.lastMessage.mine ? "You: " : ""}${chat.lastMessage.body}`
						: chat.theySwipedFirst
							? "Swiped right on you 👋"
							: "Say hi — your opener is ready ✨"}
				</p>
				<p className="truncate text-xs text-muted-foreground">
					{chat.subcategory.emoji} {chat.subcategory.name}
				</p>
			</div>
			{chat.unread && <span className="size-3 shrink-0 rounded-full border-2 border-ink bg-coral" aria-label="Unread" />}
		</Link>
	);
}
