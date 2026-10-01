import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Logo, Splash, Sticker } from "@/components/brand";
import { authClient } from "@/lib/auth-client";
import { useMe } from "@/hooks/use-app-data";
import type { Me } from "@/lib/types";

const RESEND_SECONDS = 30;

export function LoginPage() {
	const me = useMe();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [digits, setDigits] = useState("");
	const [step, setStep] = useState<"phone" | "code">("phone");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [cooldown, setCooldown] = useState(0);
	const [devCode, setDevCode] = useState<string | null>(null);

	const phoneNumber = `+91${digits}`;
	const validPhone = /^[6-9]\d{9}$/.test(digits);

	useEffect(() => {
		if (cooldown <= 0) return;
		const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
		return () => clearTimeout(t);
	}, [cooldown]);

	if (me.isPending) return <Splash />;
	if (me.data?.user) return <Navigate to={me.data.profile ? "/discover" : "/onboarding"} replace />;

	async function sendCode() {
		if (!validPhone) return;
		setBusy(true);
		const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
		setBusy(false);
		if (error) {
			toast.error(error.message || "Couldn't send the code. Try again in a minute.");
			return;
		}
		setStep("code");
		setCode("");
		setCooldown(RESEND_SECONDS);
		// Local dev only: the Worker exposes the last OTP on localhost when SMS_PROVIDER=console.
		fetch(`/api/dev/otp?phone=${encodeURIComponent(phoneNumber)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((d: { code: string | null } | null) => setDevCode(d?.code ?? null))
			.catch(() => setDevCode(null));
	}

	async function verify(value = code) {
		if (value.length !== 6) return;
		setBusy(true);
		const { error } = await authClient.phoneNumber.verify({ phoneNumber, code: value });
		if (error) {
			setBusy(false);
			setCode("");
			toast.error(error.message || "That code didn't work");
			return;
		}
		const fresh = await queryClient.fetchQuery<Me>({ queryKey: ["me"], queryFn: () => fetch("/api/me").then((r) => r.json()) });
		setBusy(false);
		navigate(fresh.profile ? "/discover" : "/onboarding", { replace: true });
	}

	return (
		<div className="flex min-h-dvh flex-col bg-dots">
			<header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
				<Link to="/" aria-label="Back to home">
					<Logo />
				</Link>
			</header>
			<main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
				<div className="rounded-[2rem] bg-card p-6 pop-lg shadow-pop-lg sm:p-8">
					{step === "phone" ? (
						<form
							className="flex flex-col gap-5"
							onSubmit={(e) => {
								e.preventDefault();
								void sendCode();
							}}
						>
							<Sticker tone="lilac" tilt={-3} className="self-start">
								Step 1 of 2
							</Sticker>
							<div>
								<h1 className="text-3xl font-extrabold">What's your number?</h1>
								<p className="mt-2 text-muted-foreground">
									We'll text you a code. Your number stays private — it's never shown to anyone.
								</p>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="phone" className="font-semibold">
									Mobile number
								</Label>
								<div className="flex gap-2">
									<span className="grid h-12 place-items-center rounded-2xl border-2 border-ink bg-peach px-4 font-bold">
										🇮🇳 +91
									</span>
									<Input
										id="phone"
										inputMode="numeric"
										autoComplete="tel-national"
										placeholder="98765 43210"
										value={digits}
										onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(-10))}
										className="font-display text-lg font-bold tracking-wider"
										autoFocus
									/>
								</div>
							</div>
							<Button type="submit" size="lg" disabled={!validPhone || busy}>
								{busy && <Loader2 className="animate-spin" />} Text me a code
							</Button>
							<p className="flex items-start gap-2 text-xs text-muted-foreground">
								<ShieldCheck className="mt-0.5 size-4 shrink-0" />
								One account per number. By continuing you confirm you're 18+ and agree to be kind.
							</p>
						</form>
					) : (
						<form
							className="flex flex-col gap-5"
							onSubmit={(e) => {
								e.preventDefault();
								void verify();
							}}
						>
							<button
								type="button"
								onClick={() => setStep("phone")}
								className="flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-ink"
							>
								<ArrowLeft className="size-4" /> Change number
							</button>
							<div>
								<h1 className="text-3xl font-extrabold">Enter the code</h1>
								<p className="mt-2 text-muted-foreground">
									Sent to <b className="text-ink">+91 {digits.slice(0, 5)} {digits.slice(5)}</b>
								</p>
							</div>
							<InputOTP
								maxLength={6}
								value={code}
								onChange={(v) => {
									setCode(v);
									if (v.length === 6) void verify(v);
								}}
								autoFocus
								inputMode="numeric"
								aria-label="One-time code"
								containerClassName="justify-center"
							>
								<InputOTPGroup>
									{Array.from({ length: 6 }, (_, i) => (
										<InputOTPSlot key={i} index={i} className="size-11 sm:size-12" />
									))}
								</InputOTPGroup>
							</InputOTP>
							{devCode && (
								<p className="rounded-2xl border-2 border-dashed border-ink bg-sky/60 px-4 py-2 text-center text-sm" data-testid="dev-otp">
									🧪 Dev mode — your code is <b className="font-display text-base tracking-widest">{devCode}</b>
								</p>
							)}
							<Button type="submit" size="lg" disabled={code.length !== 6 || busy}>
								{busy && <Loader2 className="animate-spin" />} Let me in
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={cooldown > 0 || busy}
								onClick={() => void sendCode()}
							>
								{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
							</Button>
						</form>
					)}
				</div>
			</main>
		</div>
	);
}
