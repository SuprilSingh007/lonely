import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getAuth } from "./auth";
import type { AppEnv, HonoEnv, SessionUser } from "./types";

export const sessionMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
	const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
	c.set("user", session?.user ?? null);
	await next();
});

export function isAdmin(env: AppEnv, user: Pick<SessionUser, "phoneNumber"> | null) {
	if (!user?.phoneNumber) return false;
	return env.ADMIN_PHONE_NUMBERS.split(",")
		.map((n) => n.trim())
		.includes(user.phoneNumber);
}

export const requireAdmin = createMiddleware<HonoEnv>(async (c, next) => {
	if (!c.get("user")) throw new HTTPException(401, { message: "Sign in first" });
	if (!isAdmin(c.env, c.get("user"))) throw new HTTPException(403, { message: "Admins only" });
	await next();
});

/** The signed-in user (call only behind `requireUser`). */
export function currentUser(c: { get: (key: "user") => SessionUser | null }): SessionUser {
	const user = c.get("user");
	if (!user) throw new HTTPException(401, { message: "Sign in first" });
	return user;
}
