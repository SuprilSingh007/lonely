import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { ArrowLeft, Hand, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BlobAvatar, EmptyState, Sticker } from "@/components/brand";
import { useConfig, useMe } from "@/hooks/use-app-data";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { DeckCard, Swipes } from "@/lib/types";

type Direction = "left" | "right";
const SWIPE_THRESHOLD = 110;

export function DeckPage() {
	const { suburbId = "", subId = "" } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const me = useMe();
	const config = useConfig();
	// Cards already swiped in this session (the server also excludes them on refetch).
	const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
	const [swipesOverride, setSwipes] = useState<Swipes | null>(null);
	const [exiting, setExiting] = useState<Direction | null>(null);

	const sub = config.data?.categories.flatMap((c) => c.subcategories).find((s) => s.id === subId);
	const suburb = config.data?.suburbs.find((s) => s.id === suburbId);
	const joined = me.data?.memberships.some((m) => m.subcategoryId === subId);

	const deck = useQuery({
		queryKey: ["deck", suburbId, subId],
		queryFn: () => api<{ cards: DeckCard[]; swipes: Swipes }>(`/deck?suburb=${suburbId}&subcategory=${subId}`),
		enabled: Boolean(joined),
		staleTime: Infinity,
		gcTime: 0,
		retry: false,
	});

	const cards = deck.data ? deck.data.cards.filter((c) => !gone.has(c.userId)) : null;
	const swipes = swipesOverride ?? deck.data?.swipes ?? null;

	const swipe = useMutation({
		mutationFn: ({ card, direction }: { card: DeckCard; direction: Direction }) =>
			api<{ conversationId: string | null; swipes: Swipes }>("/deck/swipe", {
				method: "POST",
				body: { targetId: card.userId, subcategoryId: subId, suburbId, direction },
			}),
		onSuccess: (data, { direction }) => {
			setSwipes(data.swipes);
			void queryClient.invalidateQueries({ queryKey: ["me"] });
			if (direction === "right" && data.conversationId) {
				void queryClient.invalidateQueries({ queryKey: ["chats"] });
				navigate(`/chats/${data.conversationId}`, { state: { fromDeck: `/discover/${suburbId}/${subId}` } });
			}
		},
		onError: (e, { card }) => {
			// Put the card back so nothing is lost.
			setGone((prev) => {
				const next = new Set(prev);
				next.delete(card.userId);
				return next;
			});
			if (e instanceof ApiError && e.status === 429) {
				setSwipes((s) => (s ? { ...s, left: 0 } : s));
			}
			toast.error(errorMessage(e));
		},
	});

	if (me.isPending || config.isPending) return <DeckSkeleton />;
	if (!joined) return <Navigate to={`/interests/${subId}`} replace />;
	if (!sub || !suburb) {
		return (
			<EmptyState emoji="🗺️" title="That deck doesn't exist" action={<Button asChild><Link to="/discover">Back to Discover</Link></Button>} />
		);
	}

	const outOfSwipes = swipes !== null && swipes.left <= 0;
	const top = cards?.[0];

	function decide(direction: Direction) {
		if (!top || swipe.isPending || exiting || outOfSwipes) return;
		setExiting(direction);
	}

	function onExited(direction: Direction) {
		if (!top) return;
		setExiting(null);
		setGone((prev) => new Set(prev).add(top.userId));
		swipe.mutate({ card: top, direction });
	}

	return (
		<div className="mx-auto flex max-w-md flex-col gap-4 sm:gap-5 md:max-w-lg">
			<header className="flex items-center gap-2">
				<Button asChild variant="outline" size="icon-sm" aria-label="Back to decks">
					<Link to="/discover">
						<ArrowLeft />
					</Link>
				</Button>
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-xl leading-tight font-extrabold sm:text-3xl">
						{sub.emoji} {sub.name}
					</h1>
					<p className="text-xs font-semibold text-muted-foreground sm:text-sm">in {suburb.name}, Pune</p>
				</div>
				{swipes && (
					<Sticker tone={swipes.left > 0 ? "mint" : "peach"} tilt={2} className="shrink-0">
						<span data-testid="swipes-left">{swipes.left}</span> left
					</Sticker>
				)}
			</header>

			{/* Sized so card + buttons fit above the mobile tab bar on small phones. */}
			<div className="relative h-[clamp(300px,calc(100dvh-24rem),480px)]">
				{deck.isPending || cards === null ? (
					<Skeleton className="absolute inset-0 rounded-[2rem]" />
				) : outOfSwipes ? (
					<div className="absolute inset-0 grid place-items-center rounded-[2rem] bg-peach pop">
						<EmptyState emoji="🌄" title={`That's all ${swipes?.limit} swipes for today`}>
							Go touch some Sahyadri grass. Your deck refills at midnight. Meanwhile, your chats are waiting.
						</EmptyState>
					</div>
				) : !top ? (
					<div className="absolute inset-0 grid place-items-center rounded-[2rem] bg-card pop">
						<EmptyState
							emoji="🍃"
							title="You've seen everyone here"
							action={
								<div className="flex flex-wrap justify-center gap-2">
									<Button variant="outline" onClick={() => void deck.refetch()} disabled={deck.isFetching}>
										{deck.isFetching ? <Loader2 className="animate-spin" /> : <RotateCcw />} Check again
									</Button>
									<Button asChild>
										<Link to="/discover">Try another suburb</Link>
									</Button>
								</div>
							}
						>
							New people join every day. People you passed come back if they update their answers.
						</EmptyState>
					</div>
				) : (
					<>
						{cards.slice(1, 3).map((card, i) => (
							<div
								key={card.userId}
								aria-hidden
								className="absolute inset-0 rounded-[2rem] bg-lilac pop"
								style={{ rotate: `${i === 0 ? -3 : 4}deg`, scale: 0.97 - i * 0.03, zIndex: 2 - i }}
							/>
						))}
						<SwipeCard
							key={top.userId}
							card={top}
							subLabel={`${sub.emoji} ${sub.name}`}
							exiting={exiting}
							onDecide={decide}
							onExited={onExited}
						/>
					</>
				)}
			</div>

			<div className="flex items-center justify-center gap-6">
				<Button
					variant="outline"
					size="icon-lg"
					className="size-16"
					aria-label="Pass"
					disabled={!top || outOfSwipes || swipe.isPending}
					onClick={() => decide("left")}
				>
					<X className="size-7" />
				</Button>
				<Button
					size="lg"
					className="h-16 px-8 text-lg"
					aria-label="Say hi"
					disabled={!top || outOfSwipes || swipe.isPending}
					onClick={() => decide("right")}
				>
					{swipe.isPending ? <Loader2 className="animate-spin" /> : <Hand className="size-6" />} Say hi
				</Button>
			</div>
			<p className="hidden text-center text-xs text-muted-foreground sm:block">
				Drag the card or use the buttons. Saying hi opens a chat right away — no waiting for a match.
			</p>
		</div>
	);
}

function SwipeCard({
	card,
	subLabel,
	exiting,
	onDecide,
	onExited,
}: {
	card: DeckCard;
	subLabel: string;
	exiting: Direction | null;
	onDecide: (d: Direction) => void;
	onExited: (d: Direction) => void;
}) {
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
	const passOpacity = useTransform(x, [-140, -30], [1, 0]);
	const hiOpacity = useTransform(x, [30, 140], [0, 1]);

	useEffect(() => {
		if (!exiting) return;
		const target = (exiting === "right" ? 1 : -1) * (window.innerWidth + 200);
		const controls = animate(x, target, { type: "tween", duration: 0.28, ease: "easeIn" });
		void controls.then(() => onExited(exiting));
		return () => controls.stop();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [exiting]);

	return (
		<motion.article
			data-testid="swipe-card"
			className="absolute inset-0 z-10 flex cursor-grab touch-pan-y flex-col gap-3 overflow-hidden rounded-[2rem] bg-card p-5 sm:gap-4 pop-lg shadow-pop-lg select-none active:cursor-grabbing sm:p-7"
			style={{ x, rotate }}
			drag={exiting ? false : "x"}
			dragSnapToOrigin
			dragElastic={0.9}
			onDragEnd={(_, info) => {
				if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 600) onDecide("right");
				else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -600) onDecide("left");
			}}
			initial={{ scale: 0.96, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 300, damping: 24 }}
		>
			<motion.span
				style={{ opacity: passOpacity }}
				className="pointer-events-none absolute top-6 right-6 rotate-12 rounded-xl border-4 border-ink bg-card px-3 py-1 font-display text-2xl font-extrabold"
			>
				PASS
			</motion.span>
			<motion.span
				style={{ opacity: hiOpacity }}
				className="pointer-events-none absolute top-6 left-6 -rotate-12 rounded-xl border-4 border-ink bg-coral px-3 py-1 font-display text-2xl font-extrabold text-white"
			>
				SAY HI 👋
			</motion.span>

			<Sticker tone="lilac" tilt={-2} className="self-start">
				{subLabel}
			</Sticker>
			<div className="flex items-center gap-3">
				<BlobAvatar handle={card.handle} className="size-14 text-lg" />
				<h2 className="text-2xl leading-tight font-extrabold sm:text-[1.7rem]" data-testid="card-handle">
					{card.handle}
				</h2>
			</div>
			<p className="flex-1 overflow-y-auto font-display text-lg leading-snug font-semibold sm:text-2xl">
				“{card.summary}”
			</p>
			<p className="text-xs font-semibold text-muted-foreground">Age, photo and name stay hidden. Only the vibe.</p>
		</motion.article>
	);
}

function DeckSkeleton() {
	return (
		<div className="mx-auto flex max-w-md flex-col gap-5">
			<Skeleton className="h-8 w-2/3 rounded-xl" />
			<Skeleton className="h-[420px] rounded-[2rem]" />
		</div>
	);
}
