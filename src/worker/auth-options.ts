import type { BetterAuthOptions } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { generateHandle } from "./lib/handles";

export const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

type PhoneOptions = {
	sendOTP: (data: { phoneNumber: string; code: string }) => Promise<void> | void;
	/** SMS_PROVIDER=console: local dev, where everyone shares one IP and SMS costs nothing. */
	devSms?: boolean;
};

/**
 * Options shared by the Worker (src/worker/auth.ts) and the Better Auth CLI
 * (auth.config.ts) so `npx auth generate` sees the same schema as runtime.
 */
export function authOptions({ sendOTP, devSms = false }: PhoneOptions) {
	return {
		appName: "Ghulo Milo",
		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
			cookieCache: { enabled: true, maxAge: 60 * 5 },
		},
		rateLimit: {
			enabled: true,
			// Workers isolates don't share memory, so keep counters in D1.
			storage: "database",
			window: 60,
			max: 100,
			customRules: {
				"/phone-number/send-otp": { window: 60, max: devSms ? 60 : 3 },
				"/phone-number/verify": { window: 60, max: devSms ? 60 : 10 },
			},
		},
		advanced: {
			// Cloudflare puts the real client IP here; rate limits are per IP.
			ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
		},
		plugins: [
			phoneNumber({
				otpLength: 6,
				expiresIn: 300,
				allowedAttempts: 5,
				phoneNumberValidator: (value) => INDIAN_MOBILE.test(value),
				sendOTP,
				signUpOnVerification: {
					// Better Auth needs an email column; phone-only users get an unroutable placeholder.
					getTempEmail: (value) => `${value.replace(/\D/g, "")}@phone.ghulomilo.invalid`,
					getTempName: () => generateHandle(),
				},
			}),
		],
	} satisfies BetterAuthOptions;
}
