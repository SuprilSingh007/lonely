import { Link, Navigate } from "react-router";
import { ArrowRight, EyeOff, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, Splash, Sticker } from "@/components/brand";
import { useMe } from "@/hooks/use-app-data";

const SAMPLE_CARDS = [
	{
		handle: "Caffeinated Pangolin 27",
		interest: "🎙️ Nikhil Kamath's WTF podcast",
		summary: "Believes the best episode was the one on failure, not funding. Has opinions on UPI vs crypto.",
		tilt: -4,
		tone: "bg-lilac",
	},
	{
		handle: "Monsoon Misal 63",
		interest: "⛰️ Sahyadri treks & forts",
		summary: "Would climb Rajgad again tomorrow. Won't trek without kanda bhaji at the top.",
		tilt: 3,
		tone: "bg-peach",
	},
];

export function LandingPage() {
	const me = useMe();
	if (me.isPending) return <Splash />;
	if (me.data?.user) return <Navigate to={me.data.profile ? "/discover" : "/onboarding"} replace />;

	return (
		<div className="min-h-dvh overflow-x-clip bg-dots">
			<header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
				<Logo />
				<Button asChild variant="outline" size="sm">
					<Link to="/login">Sign in</Link>
				</Button>
			</header>

			<section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
				<div className="flex flex-col items-start gap-6">
					<Sticker tone="mint" tilt={-3}>
						<MapPin className="size-3.5" /> Now live in Pune · Wagholi · Hadapsar · Wakad · Baner
					</Sticker>
					<h1 className="text-[2.6rem] leading-[0.95] font-extrabold sm:text-6xl lg:text-7xl">
						4,000 followers.
						<br />
						<span className="relative inline-block">
							<span className="relative z-10">3 real friends?</span>
							<span className="absolute inset-x-0 bottom-1 -z-0 h-4 -rotate-1 bg-coral/70 sm:h-5" aria-hidden />
						</span>
					</h1>
					<p className="max-w-xl text-lg text-muted-foreground sm:text-xl">
						Ghulo Milo finds people <b className="text-ink">in your suburb</b> who are into the{" "}
						<b className="text-ink">same oddly specific thing</b> as you. No photos. No names. Just a quirky handle
						and what you actually care about.
					</p>
					<div className="flex flex-wrap items-center gap-3">
						<Button asChild size="lg">
							<Link to="/login">
								Find my people <ArrowRight />
							</Link>
						</Button>
						<span className="text-sm text-muted-foreground">Free · Phone number only · 18+</span>
					</div>
				</div>

				<div className="relative mx-auto h-[400px] w-full max-w-sm sm:h-[440px]" aria-hidden>
					{SAMPLE_CARDS.map((card, i) => (
						<div
							key={card.handle}
							style={{ rotate: `${card.tilt}deg`, top: i * 170, left: i * 28 }}
							className={`absolute w-[88%] rounded-3xl p-5 ${card.tone} pop-lg shadow-pop-lg`}
						>
							<Sticker tone="paper" className="mb-4">
								{card.interest}
							</Sticker>
							<p className="font-display text-2xl font-extrabold">{card.handle}</p>
							<p className="mt-2 text-base">{card.summary}</p>
							<div className="mt-5 flex gap-2">
								<span className="rounded-full border-2 border-ink bg-card px-4 py-1.5 text-sm font-bold">Pass</span>
								<span className="rounded-full border-2 border-ink bg-coral px-4 py-1.5 text-sm font-bold text-white">
									Say hi 👋
								</span>
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-3 sm:px-6">
				{[
					{
						icon: Sparkles,
						title: "Niche > broad",
						body: "Not just “startups” — Nikhil Kamath's podcast. Not just “music” — Hindustani classical.",
						tone: "bg-lilac",
					},
					{
						icon: EyeOff,
						title: "No snap judgments",
						body: "No photo, gender or name. Your age only shows once a chat opens.",
						tone: "bg-sky",
					},
					{
						icon: MessageCircle,
						title: "One swipe = one chat",
						body: "Swipe right and a chat opens with a conversation starter. No waiting for a match.",
						tone: "bg-peach",
					},
				].map(({ icon: Icon, title, body, tone }) => (
					<div key={title} className={`rounded-3xl p-5 pop ${tone}`}>
						<Icon className="mb-3 size-7" />
						<h2 className="text-xl font-extrabold">{title}</h2>
						<p className="mt-1 text-muted-foreground">{body}</p>
					</div>
				))}
			</section>
		</div>
	);
}
