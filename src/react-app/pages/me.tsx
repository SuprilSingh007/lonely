import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, MapPin, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { BlobAvatar, PageHeader, Sticker } from "@/components/brand";
import { useConfig, useMe } from "@/hooks/use-app-data";
import { api, errorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type BlockRow = { userId: string; handle: string | null; createdAt: string };

export function MePage() {
	const me = useMe();
	const config = useConfig();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const user = me.data?.user;
	const profile = me.data?.profile;

	const blocks = useQuery({ queryKey: ["blocks"], queryFn: () => api<{ blocks: BlockRow[] }>("/blocks") });

	const moveSuburb = useMutation({
		mutationFn: (suburbId: string) =>
			api("/me/profile", { method: "PUT", body: { birthDate: profile?.birthDate, suburbId } }),
		onSuccess: () => {
			toast.success("Home suburb updated");
			void queryClient.invalidateQueries({ queryKey: ["me"] });
		},
		onError: (e) => toast.error(errorMessage(e)),
	});

	const unblock = useMutation({
		mutationFn: (userId: string) => api(`/blocks/${userId}`, { method: "DELETE" }),
		onSuccess: () => {
			toast.success("Unblocked");
			void queryClient.invalidateQueries({ queryKey: ["blocks"] });
			void queryClient.invalidateQueries({ queryKey: ["chats"] });
		},
	});

	async function signOut() {
		await authClient.signOut();
		queryClient.clear();
		navigate("/", { replace: true });
	}

	if (!user || !profile) return null;
	const phone = user.phoneNumber ?? "";

	return (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<PageHeader kicker="Only you can see this page" title="Me" />

			<section className="relative flex flex-col items-start gap-4 rounded-[2rem] bg-lilac p-6 pop-lg shadow-pop-lg sm:flex-row sm:items-center">
				<BlobAvatar handle={user.handle} className="size-20 text-2xl" />
				<div className="min-w-0">
					<p className="text-sm font-semibold text-muted-foreground">You're known as</p>
					<h2 className="text-3xl leading-tight font-extrabold">{user.handle}</h2>
					<div className="mt-3 flex flex-wrap gap-2">
						<Sticker tone="paper">{profile.age} yrs · shown only in chats</Sticker>
						<Sticker tone="paper">
							{me.data?.memberships.length ?? 0} interest{me.data?.memberships.length === 1 ? "" : "s"}
						</Sticker>
					</div>
				</div>
				{user.isAdmin && (
					<Sticker tone="grape" tilt={4} className="absolute -top-3 right-5">
						Curator
					</Sticker>
				)}
			</section>

			<section className="flex flex-col gap-3 rounded-3xl bg-card p-5 pop">
				<h2 className="flex items-center gap-2 text-lg font-extrabold">
					<MapPin className="size-5" /> Home suburb
				</h2>
				<p className="-mt-1 text-sm text-muted-foreground">Decks in this suburb show your card.</p>
				<div className="flex flex-wrap gap-2">
					{config.data?.suburbs.map((s) => (
						<button
							key={s.id}
							disabled={moveSuburb.isPending}
							onClick={() => s.id !== profile.suburbId && moveSuburb.mutate(s.id)}
							aria-pressed={s.id === profile.suburbId}
							className={cn(
								"rounded-full border-2 border-ink px-4 py-2 text-sm font-semibold pressable",
								s.id === profile.suburbId ? "bg-coral text-white shadow-pop-sm" : "bg-paper hover:bg-peach",
							)}
						>
							{s.name}
						</button>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-3 rounded-3xl bg-card p-5 pop">
				<h2 className="flex items-center gap-2 text-lg font-extrabold">
					<ShieldCheck className="size-5" /> Privacy & safety
				</h2>
				<ul className="flex flex-col gap-1 text-sm">
					<li>
						📱 Verified number: <b>+91 ••••• {phone.slice(-5)}</b> (never shown to anyone)
					</li>
					<li>🙈 No photo, gender or real name — ever.</li>
					<li>🎂 Your age appears only inside chats.</li>
				</ul>
				<div className="mt-2">
					<h3 className="font-bold">Blocked ({blocks.data?.blocks.length ?? 0})</h3>
					{blocks.data?.blocks.length ? (
						<ul className="mt-2 flex flex-col gap-2">
							{blocks.data.blocks.map((b) => (
								<li key={b.userId} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-2">
									<span className="truncate font-semibold">{b.handle ?? "Someone"}</span>
									<Button size="xs" variant="outline" onClick={() => unblock.mutate(b.userId)}>
										Unblock
									</Button>
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-muted-foreground">Nobody. Lovely.</p>
					)}
				</div>
			</section>

			<div className="flex flex-wrap gap-3">
				{user.isAdmin && (
					<Button asChild variant="secondary">
						<Link to="/admin">
							<Shield /> Admin panel
						</Link>
					</Button>
				)}
				<Button variant="outline" onClick={() => void signOut()}>
					<LogOut /> Sign out
				</Button>
			</div>
		</div>
	);
}
