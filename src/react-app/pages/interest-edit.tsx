import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Layers, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Sticker } from "@/components/brand";
import { useMe } from "@/hooks/use-app-data";
import { api, errorMessage } from "@/lib/api";
import type { SubcategoryDetail } from "@/lib/types";

export function InterestEditPage() {
	const { subId = "" } = useParams();
	const me = useMe();
	const detail = useQuery({
		queryKey: ["subcategory", subId],
		queryFn: () => api<SubcategoryDetail>(`/subcategories/${subId}`),
	});

	if (detail.isPending) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-10 w-2/3 rounded-2xl" />
				<Skeleton className="h-40 rounded-3xl" />
				<Skeleton className="h-40 rounded-3xl" />
			</div>
		);
	}
	if (detail.isError) {
		return (
			<EmptyState emoji="🫥" title="That interest wandered off" action={<Button asChild><Link to="/interests">Back to interests</Link></Button>}>
				{errorMessage(detail.error)}
			</EmptyState>
		);
	}

	// Key by interest so navigating between interests resets the form.
	return (
		<PromptForm
			key={detail.data.subcategory.id}
			detail={detail.data}
			suburbId={me.data?.profile?.suburbId ?? ""}
		/>
	);
}

function PromptForm({ detail, suburbId }: { detail: SubcategoryDetail; suburbId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { subcategory, category, prompts, membership } = detail;
	const [answers, setAnswers] = useState<Record<string, string[]>>(membership?.answers ?? {});
	const [result, setResult] = useState<{ summary: string; summarySource: string } | null>(null);

	const complete = prompts.every((p) => (answers[p.id]?.length ?? 0) > 0);

	const save = useMutation({
		mutationFn: () =>
			api<{ summary: string; summarySource: string; changed: boolean }>(`/memberships/${subcategory.id}`, {
				method: "PUT",
				body: { answers },
			}),
		onSuccess: (data) => {
			setResult(data);
			void queryClient.invalidateQueries({ queryKey: ["me"] });
			void queryClient.invalidateQueries({ queryKey: ["subcategory", subcategory.id] });
			window.scrollTo({ top: 0, behavior: "smooth" });
		},
		onError: (e) => toast.error(errorMessage(e)),
	});

	function toggle(promptId: string, option: string, kind: "single" | "multi", max: number) {
		setAnswers((prev) => {
			const current = prev[promptId] ?? [];
			if (kind === "single") return { ...prev, [promptId]: [option] };
			if (current.includes(option)) return { ...prev, [promptId]: current.filter((o) => o !== option) };
			if (current.length >= max) {
				toast(`Pick up to ${max} — drop one first`);
				return prev;
			}
			return { ...prev, [promptId]: [...current, option] };
		});
	}

	if (result) {
		return (
			<div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-6 text-center">
				<Sticker tone="mint" tilt={-3}>
					<Check className="size-3.5" /> {membership ? "Answers updated" : "You joined"} {subcategory.name}
				</Sticker>
				<div className="w-full rounded-[2rem] bg-lilac p-6 text-left pop-lg shadow-pop-lg">
					<p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
						<Sparkles className="size-4" /> Your blurb for this deck
					</p>
					<p className="mt-3 font-display text-2xl leading-snug font-bold" data-testid="summary">
						{result.summary}
					</p>
				</div>
				<p className="text-sm text-muted-foreground">
					This is what people nearby see on your card. Change your answers any time and we'll rewrite it.
				</p>
				<div className="flex flex-wrap justify-center gap-3">
					<Button size="lg" onClick={() => navigate(`/discover/${suburbId}/${subcategory.id}`)}>
						<Layers /> Open the deck
					</Button>
					<Button size="lg" variant="outline" asChild>
						<Link to="/interests">More interests</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<form
			className="mx-auto flex max-w-2xl flex-col gap-6"
			onSubmit={(e) => {
				e.preventDefault();
				save.mutate();
			}}
		>
			<Link to="/interests" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-ink">
				<ArrowLeft className="size-4" /> Interests
			</Link>
			<header className="flex flex-col gap-2">
				{category && (
					<p className="text-sm font-semibold text-muted-foreground">
						{category.emoji} {category.name}
					</p>
				)}
				<h1 className="text-3xl leading-tight font-extrabold lg:text-4xl">
					{subcategory.emoji} {subcategory.name}
				</h1>
				<p className="text-muted-foreground">{subcategory.blurb}</p>
			</header>

			{!subcategory.active ? (
				<EmptyState emoji="🚧" title="Not open yet">
					The curator is still writing questions for this one. Check back soon!
				</EmptyState>
			) : (
				<>
					<div className="rounded-2xl border-2 border-dashed border-ink bg-sky/40 px-4 py-3 text-sm">
						Tap answers instead of typing a bio — it keeps everyone anonymous and makes your blurb way more fun.
					</div>
					{prompts.map((p, i) => (
						<fieldset key={p.id} className="flex flex-col gap-3 rounded-3xl bg-card p-5 pop">
							<legend className="sr-only">{p.question}</legend>
							<div className="flex items-start gap-3">
								<span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-coral font-display font-bold text-white">
									{i + 1}
								</span>
								<div>
									<p className="font-display text-lg leading-snug font-bold">{p.question}</p>
									<p className="text-xs text-muted-foreground">
										{p.kind === "single" ? "Pick one" : `Pick up to ${p.maxSelect}`}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								{p.options.map((o) => {
									const selected = answers[p.id]?.includes(o) ?? false;
									return (
										<button
											type="button"
											key={o}
											aria-pressed={selected}
											onClick={() => toggle(p.id, o, p.kind, p.maxSelect)}
											className={cn(
												"inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-4 py-2 text-sm font-semibold pressable",
												selected ? "bg-lilac shadow-pop-sm" : "bg-paper hover:bg-peach",
											)}
										>
											{selected && <Check className="size-4" />}
											{o}
										</button>
									);
								})}
							</div>
						</fieldset>
					))}
					<div className="sticky bottom-24 z-10 lg:bottom-6">
						<Button type="submit" size="lg" className="w-full" disabled={!complete || save.isPending}>
							{save.isPending ? (
								<>
									<Loader2 className="animate-spin" /> Writing your blurb…
								</>
							) : membership ? (
								"Save & rewrite my blurb"
							) : (
								"Join & write my blurb"
							)}
						</Button>
					</div>
				</>
			)}
		</form>
	);
}
