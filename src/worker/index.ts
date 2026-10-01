import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb, schema } from "./db";
import { sessionMiddleware } from "./middleware";
import { adminRoutes } from "./routes/admin";
import { matchRoutes } from "./routes/match";
import { profileRoutes } from "./routes/profile";
import type { HonoEnv } from "./types";

export { ChatRoom } from "./chat-room";

const app = new Hono<HonoEnv>().basePath("/api");

app.on(["GET", "POST"], "/auth/*", (c) => getAuth().handler(c.req.raw));

// Every other route sees the session; handlers call currentUser() (401 when signed out).
app.use("*", sessionMiddleware);

app.get("/health", (c) => c.json({ ok: true }));

/**
 * Dev-only OTP inbox for SMS_PROVIDER=console. Only answers on localhost so a
 * misconfigured deploy can never leak codes.
 */
app.get("/dev/otp", async (c) => {
	const host = new URL(c.req.url).hostname;
	if (c.env.SMS_PROVIDER !== "console" || !["localhost", "127.0.0.1"].includes(host)) {
		throw new HTTPException(404, { message: "Not found" });
	}
	const phone = c.req.query("phone") ?? "";
	const row = await getDb(c.env.DB).query.devOtp.findFirst({ where: eq(schema.devOtp.phoneNumber, phone) });
	return c.json({ code: row?.code ?? null });
});

app.route("/", profileRoutes);
app.route("/", matchRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return c.json({ error: err.message || "Request failed" }, err.status);
	}
	console.error(err);
	return c.json({ error: "Something went wrong" }, 500);
});

export default app;
