import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authOptions } from "./auth-options";
import { getDb, schema } from "./db";
import { deliverOtp } from "./lib/sms";
import type { AppEnv } from "./types";

function createAuth() {
	const appEnv = env as AppEnv;
	return betterAuth({
		...authOptions({
			sendOTP: ({ phoneNumber, code }) => deliverOtp(appEnv, phoneNumber, code),
			devSms: appEnv.SMS_PROVIDER === "console",
		}),
		baseURL: appEnv.BETTER_AUTH_URL || undefined,
		secret: appEnv.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(appEnv.DB), { provider: "sqlite", schema }),
	});
}

let auth: ReturnType<typeof createAuth> | undefined;

/** One Better Auth instance per isolate; bindings come from `cloudflare:workers`. */
export function getAuth() {
	auth ??= createAuth();
	return auth;
}
