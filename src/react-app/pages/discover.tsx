import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Lock, MapPin } from "lucide-react";
import { cn } from "cn";
import { PageHeader, Sticker } from "@/components/brand";
import { useConfig, useMe } from "@/hooks/use-app-data";

const SUBURB_KEY = "gm:deck-suburb";

function readSuburb(fallback: string) {
	try {
		return localStorage.getItem(SUBURB_KEY) || fallback;
	} catch {
		return fallback;
	}
}

export function DiscoverPage() {
	const me = useMe();
	const config = useConfig();
	const [suburbId, setSuburbId] = useState(() => readSuburb(me.data?.profile?.suburbId ?? ""));
	const memberships = me.data?.memberships ?? [];
	const joined = new Set(memberships.map((m) => m.subcategoryId));
	const swipes = me.data?.swipes;
	const suburb = config.data?.suburbs.find((s) => s.id === suburbId);

	function chooseSuburb(id: string) {
		setSuburbId(id);
		try {
			localStorage.setItem(SUBURB_KEY, id);
		} catch {
			// private mode — fine
		}
	}

	return (
		<div className="flex flex-col gap-8">
			<PageHeader kicker="Who's around and into your thing?" title="Discover">
				{swipes && (
					<Sticker tone={swipes.left > 0 ? "mint" : "peach"} tilt={2} className="text-sm">
						{swipes.left}/{swipes.limit} swipes left today
					</Sticker>
				)}
			</PageHeader>

			<section className="flex flex-col gap-3">
				<h2 className="flex items-center gap-2 text-lg font-extrabold">
					<MapPin className="size-5" /> Pick a suburb
				</h2>
				<div className="flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Suburb">
					{config.data?.suburbs.map((s) => (
						<button
							key={s.id}
							role="radio"
							aria-checked={s.id === suburbId}
							onClick={() => chooseSuburb(s.id)}
							className={cn(
								"shrink-0 rounded-full border-2 border-ink px-5 py-2 font-semibold pressable",
								s.id === suburbId ? "bg-ink text-paper shadow-pop-sm" : "bg-card hover:bg-peach",
							)}
						>
							{s.name}
							{s.id === me.data?.profile?.suburbId && " 🏠"}
						</button>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-lg font-extrabold">Your decks in {suburb?.name ?? "…"}</h2>
				{memberships.length === 0 ? (
					<Link
						to="/interests"
						className="flex items-center justify-between gap-3 rounded-3xl bg-coral p-5 text-white pop pressable"
					>
						<div>
							<p className="font-display text-xl font-extrabold">Join an interest to get a deck</p>
							<p className="text-sm opacity-90">3 quick taps, then you're swiping.</p>
						</div>
						<ArrowRight className="size-6 shrink-0" />
					</Link>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						{memberships.map((m, i) => (
							<Link
								key={m.subcategoryId}
								to={`/discover/${suburbId}/${m.subcategoryId}`}
								className={cn(
									"group relative flex min-h-36 flex-col justify-between gap-4 overflow-hidden rounded-3xl p-5 pop pressable",
									["bg-lilac", "bg-peach", "bg-sky", "bg-mint/50"][i % 4],
								)}
							>
								<span className="text-4xl" style={{ rotate: `${i % 2 ? 6 : -6}deg` }}>
									{m.emoji}
								</span>
								<div>
									<p className="font-display text-xl leading-tight font-extrabold">{m.name}</p>
									<p className="mt-1 flex items-center gap-1 text-sm font-semibold">
										Open deck <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
									</p>
								</div>
							</Link>
						))}
					</div>
				)}
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-lg font-extrabold">More decks to unlock</h2>
				<p className="-mt-2 text-sm text-muted-foreground">Answer three questions to join any of these.</p>
				<div className="flex flex-wrap gap-2">
					{config.data?.categories
						.flatMap((c) => c.subcategories)
						.filter((s) => !joined.has(s.id))
						.map((s) => (
							<Link
								key={s.id}
								to={`/interests/${s.id}`}
								className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card px-3 py-1.5 text-sm font-semibold pressable hover:bg-peach"
							>
								<Lock className="size-3.5 opacity-60" /> {s.emoji} {s.name}
							</Link>
						))}
				</div>
			</section>
		</div>
	);
}
