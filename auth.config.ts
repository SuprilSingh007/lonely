/**
 * Better Auth CLI entry point, used only by `npm run auth:generate`.
 * The Worker builds its real instance in src/worker/auth.ts.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import { authOptions } from "./src/worker/auth-options";

export const auth = betterAuth({
	...authOptions({ sendOTP: () => {} }),
	database: drizzleAdapter(drizzle({} as D1Database), { provider: "sqlite" }),
});
