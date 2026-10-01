import { cn } from "cn";

/** Wordmark: a tilted coral sticker + display type. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
	return (
		<span className={cn("inline-flex items-center gap-2 font-display font-extrabold tracking-tight", className)}>
			<span className="grid size-9 -rotate-6 place-items-center rounded-xl bg-coral text-lg text-white pop-sm" aria-hidden>
				👋
			</span>
			{!compact && (
				<span className="text-xl leading-none">
					Ghulo<span className="text-coral">Milo</span>
				</span>
			)}
		</span>
	);
}

const BLOB_COLORS = ["bg-coral text-white", "bg-grape text-white", "bg-mint text-ink", "bg-sky text-ink", "bg-lilac text-ink", "bg-peach text-ink"];
const BLOB_SHAPES = [
	"rounded-[42%_58%_55%_45%/48%_42%_58%_52%]",
	"rounded-[60%_40%_45%_55%/55%_60%_40%_45%]",
	"rounded-[50%_50%_38%_62%/62%_45%_55%_38%]",
];

function hash(s: string) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
	return Math.abs(h);
}

/** No photos, ever: a colour blob with the handle's initials (design.md §5). */
export function BlobAvatar({ handle, className }: { handle: string; className?: string }) {
	const h = hash(handle);
	const initials = handle
		.split(" ")
		.filter((w) => /^[A-Za-z]/.test(w))
		.slice(0, 2)
		.map((w) => w[0])
		.join("");
	return (
		<span
			aria-hidden
			className={cn(
				"grid size-11 shrink-0 place-items-center border-2 border-ink font-display text-sm font-extrabold",
				BLOB_COLORS[h % BLOB_COLORS.length],
				BLOB_SHAPES[h % BLOB_SHAPES.length],
				className,
			)}
		>
			{initials}
		</span>
	);
}

const STICKER_TONES = {
	coral: "bg-coral text-white",
	grape: "bg-grape text-white",
	mint: "bg-mint text-ink",
	sky: "bg-sky text-ink",
	lilac: "bg-lilac text-ink",
	peach: "bg-peach text-ink",
	paper: "bg-card text-ink",
} as const;

export type StickerTone = keyof typeof STICKER_TONES;
export const TONES: StickerTone[] = ["coral", "grape", "mint", "sky", "lilac", "peach"];

export function Sticker({
	children,
	tone = "paper",
	tilt = 0,
	className,
}: {
	children: React.ReactNode;
	tone?: StickerTone;
	tilt?: number;
	className?: string;
}) {
	return (
		<span
			style={{ rotate: `${tilt}deg` }}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold pop-sm",
				STICKER_TONES[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}

export function EmptyState({
	emoji,
	title,
	children,
	action,
	className,
}: {
	emoji: string;
	title: string;
	children?: React.ReactNode;
	action?: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
			<span className="grid size-20 rotate-3 place-items-center rounded-3xl bg-card text-4xl pop">{emoji}</span>
			<h2 className="mt-2 text-2xl font-extrabold">{title}</h2>
			{children && <p className="max-w-sm text-muted-foreground">{children}</p>}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}

export function Splash() {
	return (
		<div className="grid min-h-dvh place-items-center bg-dots">
			<div className="flex flex-col items-center gap-4">
				<span className="grid size-16 animate-bounce place-items-center rounded-2xl bg-coral text-3xl pop">👋</span>
				<p className="font-display text-lg font-bold">Warming up the chai…</p>
			</div>
		</div>
	);
}

export function PageHeader({
	title,
	kicker,
	children,
	className,
}: {
	title: React.ReactNode;
	kicker?: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
}) {
	return (
		<header className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
			<div className="min-w-0">
				{kicker && <div className="mb-1 text-sm font-semibold text-muted-foreground">{kicker}</div>}
				<h1 className="text-3xl leading-tight font-extrabold lg:text-4xl">{title}</h1>
			</div>
			{children}
		</header>
	);
}
