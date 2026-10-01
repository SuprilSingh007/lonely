import type { getAuth } from "./auth";

/** Bindings from wrangler.json plus secrets that live in .dev.vars / `wrangler secret put`. */
export type AppEnv = Env & {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL?: string;
	TWILIO_ACCOUNT_SID?: string;
	TWILIO_AUTH_TOKEN?: string;
	TWILIO_FROM_NUMBER?: string;
};

type Auth = ReturnType<typeof getAuth>;
export type SessionUser = Auth["$Infer"]["Session"]["user"];

export type HonoEnv = {
	Bindings: AppEnv;
	Variables: {
		user: SessionUser | null;
	};
};
