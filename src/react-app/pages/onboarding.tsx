import { useState } from "react";
import { Navigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlobAvatar, Logo, Splash, Sticker } from "@/components/brand";
import { useConfig, useMe } from "@/hooks/use-app-data";
import { api, errorMessage } from "@/lib/api";

function maxBirthDate() {
	const d = new Date();
	d.setFullYear(d.getFullYear() - 18);
	return d.toISOString().slice(0, 10);
}

export function OnboardingPage() {
	const me = useMe();
	const config = useConfig();
	const queryClient = useQueryClient();
	const [birthDate, setBirthDate] = useState("");
	const [suburbId, setSuburbId] = useState("");
	const [saved, setSaved] = useState(false);

	const save = useMutation({
		mutationFn: () => api("/me/profile", { method: "PUT", body: { birthDate, suburbId } }),
		onSuccess: async () => {
			setSaved(true);
			// Once `me` has a profile, the redirect below sends new people to pick interests.
			await queryClient.invalidateQueries({ queryKey: ["me"] });
		},
		onError: (e) => toast.error(errorMessage(e)),
	});

	if (me.isPending || config.isPending) return <Splash />;
	if (!me.data?.user) return <Navigate to="/login" replace />;
	if (me.data.profile) return <Navigate to={saved ? "/interests?welcome=1" : "/discover"} replace />;

	return (
		<div className="min-h-dvh bg-dots">
			<header className="mx-auto flex max-w-xl items-center px-4 py-4">
				<Logo />
			</header>
			<main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16">
				<section className="relative rounded-[2rem] bg-lilac p-6 pop-lg shadow-pop-lg">
					<Sticker tone="coral" tilt={4} className="absolute -top-3 right-5">
						Can't be changed!
					</Sticker>
					<p className="text-sm font-semibold text-muted-foreground">Meet your alter ego</p>
					<div className="mt-3 flex items-center gap-4">
						<BlobAvatar handle={me.data.user.handle} className="size-16 text-xl" />
						<h1 className="text-3xl leading-tight font-extrabold sm:text-4xl" data-testid="handle">
							{me.data.user.handle}
						</h1>
					</div>
					<p className="mt-4 text-sm">
						This is the only name anyone will see. No photo, no gender, no real name — people meet the real you
						through your interests.
					</p>
				</section>

				<form
					className="flex flex-col gap-6 rounded-[2rem] bg-card p-6 pop"
					onSubmit={(e) => {
						e.preventDefault();
						save.mutate();
					}}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="dob" className="text-base font-bold">
							When's your birthday?
						</Label>
						<Input
							id="dob"
							type="date"
							required
							max={maxBirthDate()}
							min="1925-01-01"
							value={birthDate}
							onChange={(e) => setBirthDate(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Hidden while browsing. Your age shows up only after someone opens a chat with you.
						</p>
					</div>

					<fieldset className="flex flex-col gap-3">
						<legend className="mb-2 text-base font-bold">Which suburb do you hang out in?</legend>
						<div className="grid grid-cols-2 gap-3">
							{config.data?.suburbs.map((s) => (
								<button
									type="button"
									key={s.id}
									onClick={() => setSuburbId(s.id)}
									aria-pressed={suburbId === s.id}
									className={cn(
										"flex items-center gap-2 rounded-2xl border-2 border-ink px-4 py-3 text-left font-semibold pressable",
										suburbId === s.id ? "bg-coral text-white shadow-pop-sm" : "bg-paper hover:bg-peach",
									)}
								>
									<MapPin className="size-4 shrink-0" />
									{s.name}
								</button>
							))}
						</div>
						<p className="text-xs text-muted-foreground">
							We're starting with these Pune suburbs. You can browse other suburbs' decks too.
						</p>
					</fieldset>

					<Button type="submit" size="lg" disabled={!birthDate || !suburbId || save.isPending}>
						{save.isPending && <Loader2 className="animate-spin" />} Next: pick your interests
					</Button>
				</form>
			</main>
		</div>
	);
}
