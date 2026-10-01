import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Layers, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Sticker, TONES } from "@/components/brand";
import { useConfig, useMe } from "@/hooks/use-app-data";
import { api, errorMessage } from "@/lib/api";

export function InterestsPage() {
	const me = useMe();
	const config = useConfig();
	const [params] = useSearchParams();
	const queryClient = useQueryClient();
	const memberships = me.data?.memberships ?? [];
	const joined = new Set(memberships.map((m) => m.subcategoryId));
	const suburbId = me.data?.profile?.suburbId ?? "";

	const leave = useMutation({
		mutationFn: (id: string) => api(`/memberships/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["me"] });
			toast.success("Left that interest. Your answers are gone.");
		},
		onError: (e) => toast.error(errorMessage(e)),
	});

	return (
		<div className="flex flex-col gap-8">
			<PageHeader kicker="Your corner of the internet" title="Interests">
				<RequestInterestDialog />
			</PageHeader>

			{params.get("welcome") && memberships.length === 0 && (
				<div className="flex items-start gap-3 rounded-3xl bg-mint/40 p-4 pop-sm">
					<span className="text-2xl">🎉</span>
					<div>
						<p className="font-display text-lg font-bold">You're in! Now pick something you're into.</p>
						<p className="text-sm text-muted-foreground">
							Answer 3 quick questions and we'll write your profile blurb. Each interest has its own deck.
						</p>
					</div>
				</div>
			)}

			{memberships.length > 0 && (
				<section className="flex flex-col gap-3">
					<h2 className="text-xl font-extrabold">Joined ({memberships.length})</h2>
					<div className="grid gap-4 md:grid-cols-2">
						{memberships.map((m, i) => (
							<article key={m.subcategoryId} className="flex flex-col gap-3 rounded-3xl bg-card p-5 pop">
								<div className="flex items-start justify-between gap-3">
									<Sticker tone={TONES[i % TONES.length]} tilt={i % 2 ? 2 : -2}>
										{m.emoji} {m.name}
									</Sticker>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button variant="ghost" size="icon-sm" aria-label={`Leave ${m.name}`}>
												<Trash2 />
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>Leave {m.name}?</AlertDialogTitle>
												<AlertDialogDescription>
													You'll disappear from this deck and your answers will be deleted. Existing chats stay.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Stay</AlertDialogCancel>
												<AlertDialogAction onClick={() => leave.mutate(m.subcategoryId)}>Leave</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
								<p className="text-[15px] leading-relaxed">{m.summary}</p>
								<div className="mt-auto flex flex-wrap items-center gap-2">
									<Button asChild size="sm">
										<Link to={`/discover/${suburbId}/${m.subcategoryId}`}>
											<Layers /> Open deck
										</Link>
									</Button>
									<Button asChild size="sm" variant="outline">
										<Link to={`/interests/${m.subcategoryId}`}>
											<Pencil /> Edit answers
										</Link>
									</Button>
									{m.summarySource === "ai" && (
										<span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
											<Sparkles className="size-3.5" /> AI blurb
										</span>
									)}
								</div>
							</article>
						))}
					</div>
				</section>
			)}

			<section className="flex flex-col gap-4">
				<h2 className="text-xl font-extrabold">{memberships.length ? "Join more" : "Pick your first interest"}</h2>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{config.data?.categories
						.filter((c) => c.subcategories.length > 0)
						.map((cat, i) => (
							<div key={cat.id} className="flex flex-col gap-3 rounded-3xl bg-card p-5 pop-sm">
								<div className="flex items-center gap-3">
									<span
										className={cn(
											"grid size-11 place-items-center rounded-2xl border-2 border-ink text-xl",
											["bg-coral", "bg-lilac", "bg-mint", "bg-sky", "bg-peach", "bg-grape"][i % 6],
										)}
									>
										{cat.emoji}
									</span>
									<div className="min-w-0">
										<h3 className="text-lg leading-tight font-extrabold">{cat.name}</h3>
										<p className="truncate text-xs text-muted-foreground">{cat.blurb}</p>
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									{cat.subcategories.map((s) => (
										<Link
											key={s.id}
											to={`/interests/${s.id}`}
											className={cn(
												"inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 text-sm font-semibold pressable",
												joined.has(s.id) ? "bg-lilac" : "bg-paper hover:bg-peach",
											)}
										>
											{joined.has(s.id) ? <Check className="size-3.5" /> : <span>{s.emoji}</span>}
											{s.name}
										</Link>
									))}
								</div>
							</div>
						))}
				</div>
			</section>

			<MyRequests />
		</div>
	);
}

type RequestRow = { id: string; kind: string; name: string; status: "pending" | "approved" | "rejected" };

function MyRequests() {
	const requests = useQuery({
		queryKey: ["requests"],
		queryFn: () => api<{ requests: RequestRow[] }>("/requests"),
	});
	if (!requests.data?.requests.length) return null;
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-xl font-extrabold">Your suggestions</h2>
			<ul className="flex flex-wrap gap-2">
				{requests.data.requests.map((r) => (
					<li key={r.id}>
						<Sticker tone={r.status === "approved" ? "mint" : r.status === "rejected" ? "peach" : "paper"}>
							{r.name} · {r.status === "pending" ? "in review" : r.status}
						</Sticker>
					</li>
				))}
			</ul>
		</section>
	);
}

function RequestInterestDialog() {
	const config = useConfig();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [categoryId, setCategoryId] = useState<string>("");
	const [name, setName] = useState("");
	const [note, setNote] = useState("");

	const submit = useMutation({
		mutationFn: () =>
			api("/requests", {
				method: "POST",
				body:
					categoryId === "__new"
						? { kind: "category", name, note: note || undefined }
						: { kind: "subcategory", categoryId, name, note: note || undefined },
			}),
		onSuccess: () => {
			toast.success("Sent to the curator! We'll review it soon.");
			void queryClient.invalidateQueries({ queryKey: ["requests"] });
			setOpen(false);
			setName("");
			setNote("");
			setCategoryId("");
		},
		onError: (e) => toast.error(errorMessage(e)),
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Plus /> Suggest an interest
				</Button>
			</DialogTrigger>
			<DialogContent className="rounded-3xl border-2 border-ink shadow-pop-lg sm:max-w-md">
				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						submit.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle className="font-display text-2xl font-extrabold">Can't find your thing?</DialogTitle>
						<DialogDescription>
							Suggest a niche interest. Every one is hand-picked so decks stay tidy.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label>Where does it fit?</Label>
						<Select value={categoryId} onValueChange={setCategoryId}>
							<SelectTrigger className="h-12 w-full rounded-2xl border-2 border-ink bg-card">
								<SelectValue placeholder="Pick a category" />
							</SelectTrigger>
							<SelectContent>
								{config.data?.categories.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.emoji} {c.name}
									</SelectItem>
								))}
								<SelectItem value="__new">✨ A whole new category</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="req-name">Name it</Label>
						<Input
							id="req-name"
							placeholder="e.g. Pune's old Irani cafés"
							value={name}
							maxLength={60}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="req-note">Why? (optional)</Label>
						<Textarea
							id="req-note"
							placeholder="Tell the curator who'd love this"
							value={note}
							maxLength={280}
							onChange={(e) => setNote(e.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button type="submit" disabled={!categoryId || name.trim().length < 3 || submit.isPending}>
							{submit.isPending && <Loader2 className="animate-spin" />} Send suggestion
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
