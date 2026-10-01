import { useState } from "react";
import { Navigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, Sticker } from "@/components/brand";
import { useMe } from "@/hooks/use-app-data";
import { api, errorMessage } from "@/lib/api";

type PromptRow = {
	id: string;
	question: string;
	kind: "single" | "multi";
	options: string[];
	maxSelect: number;
	template: string;
	active: boolean;
};
type SubRow = { id: string; name: string; emoji: string; blurb: string; active: boolean; prompts: PromptRow[] };
type CatRow = { id: string; name: string; emoji: string; blurb: string; active: boolean; subcategories: SubRow[] };
type Taxonomy = { suburbs: { id: string; name: string; active: boolean }[]; categories: CatRow[] };

function useAdminMutation<T>(fn: (input: T) => Promise<unknown>, success?: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () => {
			if (success) toast.success(success);
			void queryClient.invalidateQueries({ queryKey: ["admin"] });
			void queryClient.invalidateQueries({ queryKey: ["config"] });
		},
		onError: (e) => toast.error(errorMessage(e)),
	});
}

export function AdminPage() {
	const me = useMe();
	if (!me.data?.user?.isAdmin) return <Navigate to="/discover" replace />;
	return (
		<div className="flex flex-col gap-6">
			<PageHeader kicker="Curator mode" title="Admin" />
			<Tabs defaultValue="overview" className="gap-5">
				<TabsList className="h-auto flex-wrap justify-start gap-1 rounded-full border-2 border-ink bg-card p-1">
					{["overview", "taxonomy", "requests", "safety"].map((t) => (
						<TabsTrigger
							key={t}
							value={t}
							className="rounded-full px-4 py-1.5 font-semibold capitalize data-[state=active]:bg-coral data-[state=active]:text-white"
						>
							{t}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent value="overview">
					<Overview />
				</TabsContent>
				<TabsContent value="taxonomy">
					<TaxonomyEditor />
				</TabsContent>
				<TabsContent value="requests">
					<Requests />
				</TabsContent>
				<TabsContent value="safety">
					<Safety />
				</TabsContent>
			</Tabs>
		</div>
	);
}

function Overview() {
	const overview = useQuery({
		queryKey: ["admin", "overview"],
		queryFn: () =>
			api<{
				stats: Record<string, number>;
				density: { suburbId: string; subcategoryId: string; n: number }[];
			}>("/admin/overview"),
	});
	const taxonomy = useQuery({ queryKey: ["admin", "taxonomy"], queryFn: () => api<Taxonomy>("/admin/taxonomy") });
	if (!overview.data || !taxonomy.data) return <Loader2 className="animate-spin" />;
	const { stats, density } = overview.data;
	const subs = taxonomy.data.categories.flatMap((c) => c.subcategories);
	const cell = (suburbId: string, subId: string) =>
		density.find((d) => d.suburbId === suburbId && d.subcategoryId === subId)?.n ?? 0;

	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
				{Object.entries(stats).map(([k, v], i) => (
					<div key={k} className={cn("rounded-2xl p-4 pop-sm", ["bg-lilac", "bg-peach", "bg-sky", "bg-card"][i % 4])}>
						<p className="font-display text-3xl font-extrabold">{v}</p>
						<p className="text-xs font-semibold text-muted-foreground capitalize">
							{k.replace(/([A-Z])/g, " $1").toLowerCase()}
						</p>
					</div>
				))}
			</div>
			<section className="rounded-3xl bg-card p-5 pop">
				<h2 className="text-lg font-extrabold">Deck density (people per suburb × interest)</h2>
				<p className="text-sm text-muted-foreground">Cold-start check: aim for 10+ per cell before promoting a deck.</p>
				<div className="mt-4 overflow-x-auto">
					<table className="w-full min-w-[560px] text-sm">
						<thead>
							<tr>
								<th className="p-2 text-left">Interest</th>
								{taxonomy.data.suburbs.map((s) => (
									<th key={s.id} className="p-2 text-center">
										{s.name}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{subs.map((s) => (
								<tr key={s.id} className="border-t border-ink/10">
									<td className="p-2 font-semibold">
										{s.emoji} {s.name}
									</td>
									{taxonomy.data.suburbs.map((sb) => {
										const n = cell(sb.id, s.id);
										return (
											<td key={sb.id} className="p-1 text-center">
												<span
													className={cn(
														"inline-block min-w-10 rounded-full px-2 py-0.5 font-bold",
														n >= 10 ? "bg-mint" : n >= 3 ? "bg-sky" : n > 0 ? "bg-peach" : "text-muted-foreground",
													)}
												>
													{n}
												</span>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}

function TaxonomyEditor() {
	const taxonomy = useQuery({ queryKey: ["admin", "taxonomy"], queryFn: () => api<Taxonomy>("/admin/taxonomy") });
	const [cat, setCat] = useState({ name: "", emoji: "", blurb: "" });
	const [suburbName, setSuburbName] = useState("");
	const addCategory = useAdminMutation(
		() => api("/admin/categories", { method: "POST", body: { ...cat, emoji: cat.emoji || "✨" } }),
		"Category added",
	);
	const toggleCategory = useAdminMutation((v: { id: string; active: boolean }) =>
		api(`/admin/categories/${v.id}`, { method: "PATCH", body: { active: v.active } }),
	);
	const addSuburb = useAdminMutation(() => api("/admin/suburbs", { method: "POST", body: { name: suburbName } }), "Suburb added");
	const toggleSuburb = useAdminMutation((v: { id: string; active: boolean }) =>
		api(`/admin/suburbs/${v.id}`, { method: "PATCH", body: { active: v.active } }),
	);

	if (!taxonomy.data) return <Loader2 className="animate-spin" />;

	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-3 rounded-3xl bg-card p-5 pop">
				<h2 className="text-lg font-extrabold">Suburbs</h2>
				<div className="flex flex-wrap gap-2">
					{taxonomy.data.suburbs.map((s) => (
						<label key={s.id} className="flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 py-1.5 text-sm font-semibold">
							{s.name}
							<Switch checked={s.active} onCheckedChange={(active) => toggleSuburb.mutate({ id: s.id, active })} />
						</label>
					))}
				</div>
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						addSuburb.mutate(undefined, { onSuccess: () => setSuburbName("") });
					}}
				>
					<Input placeholder="New suburb, e.g. Kothrud" value={suburbName} onChange={(e) => setSuburbName(e.target.value)} />
					<Button type="submit" disabled={suburbName.trim().length < 2}>
						<Plus /> Add
					</Button>
				</form>
			</section>

			<form
				className="grid gap-2 rounded-3xl bg-lilac p-5 pop sm:grid-cols-[80px_1fr_1fr_auto]"
				onSubmit={(e) => {
					e.preventDefault();
					addCategory.mutate(undefined, { onSuccess: () => setCat({ name: "", emoji: "", blurb: "" }) });
				}}
			>
				<h2 className="text-lg font-extrabold sm:col-span-4">New category</h2>
				<Input placeholder="🎲" value={cat.emoji} onChange={(e) => setCat({ ...cat, emoji: e.target.value })} aria-label="Emoji" />
				<Input placeholder="Name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} aria-label="Name" />
				<Input placeholder="Blurb" value={cat.blurb} onChange={(e) => setCat({ ...cat, blurb: e.target.value })} aria-label="Blurb" />
				<Button type="submit" disabled={cat.name.trim().length < 2 || addCategory.isPending}>
					<Plus /> Add
				</Button>
			</form>

			{taxonomy.data.categories.map((c) => (
				<section key={c.id} className="flex flex-col gap-3 rounded-3xl bg-card p-5 pop">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-xl font-extrabold">
							{c.emoji} {c.name}
						</h2>
						<label className="flex items-center gap-2 text-sm font-semibold">
							{c.active ? "Live" : "Hidden"}
							<Switch checked={c.active} onCheckedChange={(active) => toggleCategory.mutate({ id: c.id, active })} />
						</label>
					</div>
					{c.subcategories.map((s) => (
						<SubcategoryEditor key={s.id} sub={s} />
					))}
					<NewSubcategory categoryId={c.id} />
				</section>
			))}
		</div>
	);
}

function SubcategoryEditor({ sub }: { sub: SubRow }) {
	const [open, setOpen] = useState(false);
	const toggle = useAdminMutation((active: boolean) =>
		api(`/admin/subcategories/${sub.id}`, { method: "PATCH", body: { active } }),
	);
	const togglePrompt = useAdminMutation((v: { id: string; active: boolean }) =>
		api(`/admin/prompts/${v.id}`, { method: "PATCH", body: { active: v.active } }),
	);
	return (
		<div className="rounded-2xl border-2 border-ink bg-paper">
			<div className="flex items-center gap-3 px-4 py-3">
				<button className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold" onClick={() => setOpen(!open)}>
					<ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
					<span className="truncate">
						{sub.emoji} {sub.name}
					</span>
					<span className="shrink-0 text-xs text-muted-foreground">{sub.prompts.length} prompts</span>
				</button>
				<label className="flex items-center gap-2 text-xs font-semibold">
					{sub.active ? "Live" : "Draft"}
					<Switch checked={sub.active} onCheckedChange={(active) => toggle.mutate(active)} />
				</label>
			</div>
			{open && (
				<div className="flex flex-col gap-3 border-t-2 border-ink px-4 py-4">
					{sub.prompts.map((p) => (
						<div key={p.id} className={cn("rounded-2xl bg-card p-3", !p.active && "opacity-50")}>
							<div className="flex items-start justify-between gap-3">
								<p className="font-semibold">{p.question}</p>
								<Switch
									checked={p.active}
									onCheckedChange={(active) => togglePrompt.mutate({ id: p.id, active })}
									aria-label="Prompt active"
								/>
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								{p.kind === "single" ? "Single choice" : `Up to ${p.maxSelect}`} · {p.options.join(" / ")}
							</p>
							<p className="mt-1 text-xs">Fallback: {p.template}</p>
						</div>
					))}
					<NewPrompt subcategoryId={sub.id} />
				</div>
			)}
		</div>
	);
}

function NewSubcategory({ categoryId }: { categoryId: string }) {
	const [form, setForm] = useState({ name: "", emoji: "", blurb: "" });
	const add = useAdminMutation(
		() => api("/admin/subcategories", { method: "POST", body: { categoryId, ...form, emoji: form.emoji || "✨" } }),
		"Added as a draft — add prompts, then switch it live",
	);
	return (
		<form
			className="grid gap-2 sm:grid-cols-[80px_1fr_1fr_auto]"
			onSubmit={(e) => {
				e.preventDefault();
				add.mutate(undefined, { onSuccess: () => setForm({ name: "", emoji: "", blurb: "" }) });
			}}
		>
			<Input placeholder="🎲" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} aria-label="Emoji" />
			<Input placeholder="New interest" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Interest name" />
			<Input placeholder="Blurb" value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} aria-label="Interest blurb" />
			<Button type="submit" variant="outline" disabled={form.name.trim().length < 2}>
				<Plus /> Interest
			</Button>
		</form>
	);
}

function NewPrompt({ subcategoryId }: { subcategoryId: string }) {
	const [question, setQuestion] = useState("");
	const [kind, setKind] = useState<"single" | "multi">("single");
	const [options, setOptions] = useState("");
	const [maxSelect, setMaxSelect] = useState(2);
	const [template, setTemplate] = useState("");
	const add = useAdminMutation(
		() =>
			api("/admin/prompts", {
				method: "POST",
				body: {
					subcategoryId,
					question,
					kind,
					options: options.split(",").map((o) => o.trim()).filter(Boolean),
					maxSelect: kind === "single" ? 1 : maxSelect,
					template,
				},
			}),
		"Prompt added",
	);
	return (
		<form
			className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3"
			onSubmit={(e) => {
				e.preventDefault();
				add.mutate(undefined, {
					onSuccess: () => {
						setQuestion("");
						setOptions("");
						setTemplate("");
					},
				});
			}}
		>
			<Label className="font-bold">New prompt</Label>
			<Input placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
			<div className="flex gap-2">
				<Select value={kind} onValueChange={(v) => setKind(v as "single" | "multi")}>
					<SelectTrigger className="h-12 rounded-2xl border-2 border-ink bg-card">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="single">Pick one</SelectItem>
						<SelectItem value="multi">Pick several</SelectItem>
					</SelectContent>
				</Select>
				{kind === "multi" && (
					<Input
						type="number"
						min={1}
						max={6}
						value={maxSelect}
						onChange={(e) => setMaxSelect(Number(e.target.value))}
						className="w-24"
						aria-label="Max picks"
					/>
				)}
			</div>
			<Input placeholder="Options, comma separated" value={options} onChange={(e) => setOptions(e.target.value)} />
			<Input
				placeholder="Fallback sentence, e.g. Swears by {answer}."
				value={template}
				onChange={(e) => setTemplate(e.target.value)}
			/>
			<Button type="submit" size="sm" variant="outline" className="self-start" disabled={add.isPending}>
				<Plus /> Add prompt
			</Button>
		</form>
	);
}

type RequestRow = {
	id: string;
	kind: "category" | "subcategory";
	categoryId: string | null;
	name: string;
	note: string | null;
	status: string;
	handle: string | null;
};

function Requests() {
	const requests = useQuery({
		queryKey: ["admin", "requests"],
		queryFn: () => api<{ requests: RequestRow[] }>("/admin/requests"),
	});
	const review = useAdminMutation(
		(v: { id: string; status: "approved" | "rejected" }) =>
			api(`/admin/requests/${v.id}`, { method: "POST", body: { status: v.status } }),
		"Reviewed",
	);
	if (!requests.data) return <Loader2 className="animate-spin" />;
	if (!requests.data.requests.length) return <EmptyState emoji="📭" title="No suggestions yet" />;
	return (
		<ul className="flex flex-col gap-3">
			{requests.data.requests.map((r) => (
				<li key={r.id} className="flex flex-wrap items-center gap-3 rounded-3xl bg-card p-4 pop-sm">
					<div className="min-w-0 flex-1">
						<p className="font-display text-lg font-bold">{r.name}</p>
						<p className="text-sm text-muted-foreground">
							{r.kind === "category" ? "New category" : `Interest in ${r.categoryId}`} · from {r.handle ?? "someone"}
						</p>
						{r.note && <p className="mt-1 text-sm">“{r.note}”</p>}
					</div>
					{r.status === "pending" ? (
						<div className="flex gap-2">
							<Button size="sm" onClick={() => review.mutate({ id: r.id, status: "approved" })}>
								<Check /> Approve
							</Button>
							<Button size="sm" variant="outline" onClick={() => review.mutate({ id: r.id, status: "rejected" })}>
								<X /> Reject
							</Button>
						</div>
					) : (
						<Sticker tone={r.status === "approved" ? "mint" : "peach"}>{r.status}</Sticker>
					)}
				</li>
			))}
		</ul>
	);
}

type BlockRow = {
	blockerId: string;
	blockedId: string;
	blocker: string | null;
	blocked: string | null;
	blockedPhone: string | null;
	reason: string | null;
	conversationId: string | null;
	createdAt: number;
	timesBlocked: number;
};

function Safety() {
	const blocks = useQuery({ queryKey: ["admin", "blocks"], queryFn: () => api<{ blocks: BlockRow[] }>("/admin/blocks") });
	const [openChat, setOpenChat] = useState<string | null>(null);
	const transcript = useQuery({
		queryKey: ["admin", "transcript", openChat],
		queryFn: () =>
			api<{ messages: { id: string; body: string; handle: string | null; createdAt: string }[] }>(
				`/admin/blocks/${openChat}/messages`,
			),
		enabled: Boolean(openChat),
	});
	if (!blocks.data) return <Loader2 className="animate-spin" />;
	if (!blocks.data.blocks.length) return <EmptyState emoji="🕊️" title="No blocks. Everyone's being nice." />;
	return (
		<ul className="flex flex-col gap-3">
			{blocks.data.blocks.map((b) => (
				<li key={`${b.blockerId}-${b.blockedId}`} className="flex flex-col gap-2 rounded-3xl bg-card p-4 pop-sm">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-semibold">
							<b>{b.blocker}</b> blocked <b>{b.blocked}</b>
						</p>
						{b.timesBlocked > 1 && <Sticker tone="coral">Blocked {b.timesBlocked}×</Sticker>}
						<span className="ml-auto text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString()}</span>
					</div>
					<p className="text-xs text-muted-foreground">Their number (for follow-up): {b.blockedPhone}</p>
					{b.reason && <p className="text-sm">“{b.reason}”</p>}
					{b.conversationId && (
						<Button
							size="xs"
							variant="outline"
							className="self-start"
							onClick={() => setOpenChat(openChat === b.conversationId ? null : b.conversationId)}
						>
							{openChat === b.conversationId ? "Hide chat" : "Review chat"}
						</Button>
					)}
					{openChat === b.conversationId && transcript.data && (
						<ol className="flex flex-col gap-1 rounded-2xl bg-paper p-3 text-sm">
							{transcript.data.messages.map((m) => (
								<li key={m.id}>
									<b>{m.handle}:</b> {m.body}
								</li>
							))}
						</ol>
					)}
				</li>
			))}
		</ul>
	);
}
