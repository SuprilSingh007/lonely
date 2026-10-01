import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db";
import type { Answers } from "../db/schema";
import { writeSummary } from "../lib/ai";
import { ageFrom, startOfIstDay } from "../lib/time";
import { currentUser, isAdmin } from "../middleware";
import type { HonoEnv } from "../types";

export const profileRoutes = new Hono<HonoEnv>();

/** Public taxonomy: suburbs + active categories with their subcategories. */
profileRoutes.get("/config", async (c) => {
	const db = getDb(c.env.DB);
	const [suburbs, categories, subcategories] = await Promise.all([
		db.select().from(schema.suburb).where(eq(schema.suburb.active, true)).orderBy(asc(schema.suburb.sortOrder)),
		db.select().from(schema.category).where(eq(schema.category.active, true)).orderBy(asc(schema.category.sortOrder)),
		db
			.select()
			.from(schema.subcategory)
			.where(eq(schema.subcategory.active, true))
			.orderBy(asc(schema.subcategory.sortOrder)),
	]);
	return c.json({
		appName: c.env.APP_NAME,
		dailySwipeLimit: Number(c.env.DAILY_SWIPE_LIMIT),
		suburbs: suburbs.map(({ id, name, city }) => ({ id, name, city })),
		categories: categories.map((cat) => ({
			id: cat.id,
			name: cat.name,
			emoji: cat.emoji,
			blurb: cat.blurb,
			subcategories: subcategories
				.filter((s) => s.categoryId === cat.id)
				.map(({ id, name, emoji, blurb }) => ({ id, name, emoji, blurb })),
		})),
	});
});

export async function swipesUsedToday(db: ReturnType<typeof getDb>, userId: string) {
	const [row] = await db
		.select({ n: count() })
		.from(schema.swipe)
		.where(and(eq(schema.swipe.swiperId, userId), gte(schema.swipe.createdAt, startOfIstDay())));
	return row?.n ?? 0;
}

profileRoutes.get("/me", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ user: null });
	const db = getDb(c.env.DB);
	const [profile, memberships, used] = await Promise.all([
		db.query.profile.findFirst({ where: eq(schema.profile.userId, user.id) }),
		db
			.select({
				subcategoryId: schema.membership.subcategoryId,
				summary: schema.membership.summary,
				summarySource: schema.membership.summarySource,
				updatedAt: schema.membership.updatedAt,
				name: schema.subcategory.name,
				emoji: schema.subcategory.emoji,
				categoryId: schema.subcategory.categoryId,
			})
			.from(schema.membership)
			.innerJoin(schema.subcategory, eq(schema.subcategory.id, schema.membership.subcategoryId))
			.where(eq(schema.membership.userId, user.id))
			.orderBy(asc(schema.membership.createdAt)),
		swipesUsedToday(db, user.id),
	]);
	const limit = Number(c.env.DAILY_SWIPE_LIMIT);
	return c.json({
		user: {
			id: user.id,
			handle: profile?.handle ?? user.name,
			phoneNumber: user.phoneNumber,
			isAdmin: isAdmin(c.env, user),
		},
		profile: profile
			? {
					suburbId: profile.suburbId,
					birthDate: profile.birthDate,
					age: ageFrom(profile.birthDate),
				}
			: null,
		memberships,
		swipes: { used, limit, left: Math.max(0, limit - used) },
	});
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

profileRoutes.put(
	"/me/profile",
	zValidator("json", z.object({ birthDate: isoDate, suburbId: z.string().min(1) })),
	async (c) => {
		const user = currentUser(c);
		const { birthDate, suburbId } = c.req.valid("json");
		const age = ageFrom(birthDate);
		if (Number.isNaN(age) || age < 18) throw new HTTPException(400, { message: "You need to be 18 or older" });
		if (age > 100) throw new HTTPException(400, { message: "Please check your date of birth" });

		const db = getDb(c.env.DB);
		const area = await db.query.suburb.findFirst({ where: eq(schema.suburb.id, suburbId) });
		if (!area?.active) throw new HTTPException(400, { message: "Pick one of the listed suburbs" });

		const now = new Date();
		await db
			.insert(schema.profile)
			.values({ userId: user.id, handle: user.name, birthDate, suburbId, updatedAt: now })
			.onConflictDoUpdate({ target: schema.profile.userId, set: { birthDate, suburbId, updatedAt: now } });
		return c.json({ ok: true });
	},
);

async function loadSubcategory(db: ReturnType<typeof getDb>, id: string) {
	const sub = await db.query.subcategory.findFirst({ where: eq(schema.subcategory.id, id) });
	if (!sub) throw new HTTPException(404, { message: "No such interest" });
	const prompts = await db
		.select()
		.from(schema.prompt)
		.where(and(eq(schema.prompt.subcategoryId, id), eq(schema.prompt.active, true)))
		.orderBy(asc(schema.prompt.sortOrder));
	return { sub, prompts };
}

profileRoutes.get("/subcategories/:id", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	const { sub, prompts } = await loadSubcategory(db, c.req.param("id"));
	const [category, mine] = await Promise.all([
		db.query.category.findFirst({ where: eq(schema.category.id, sub.categoryId) }),
		db.query.membership.findFirst({
			where: and(eq(schema.membership.userId, user.id), eq(schema.membership.subcategoryId, sub.id)),
		}),
	]);
	return c.json({
		subcategory: { id: sub.id, name: sub.name, emoji: sub.emoji, blurb: sub.blurb, active: sub.active },
		category: category ? { id: category.id, name: category.name, emoji: category.emoji } : null,
		prompts: prompts.map(({ id, question, kind, options, maxSelect }) => ({ id, question, kind, options, maxSelect })),
		membership: mine ? { answers: mine.answers, summary: mine.summary, summarySource: mine.summarySource } : null,
	});
});

profileRoutes.put(
	"/memberships/:subcategoryId",
	zValidator("json", z.object({ answers: z.record(z.string(), z.array(z.string()).max(6)) })),
	async (c) => {
		const user = currentUser(c);
		const db = getDb(c.env.DB);
		const { sub, prompts } = await loadSubcategory(db, c.req.param("subcategoryId"));
		if (!sub.active || prompts.length === 0) throw new HTTPException(400, { message: "This interest is paused" });

		const raw = c.req.valid("json").answers;
		const answers: Answers = {};
		for (const p of prompts) {
			const picked = [...new Set(raw[p.id] ?? [])].filter((a) => p.options.includes(a));
			const max = p.kind === "single" ? 1 : p.maxSelect;
			if (picked.length === 0) throw new HTTPException(400, { message: `Answer: ${p.question}` });
			if (picked.length > max) throw new HTTPException(400, { message: `Pick up to ${max} for: ${p.question}` });
			answers[p.id] = picked;
		}

		const existing = await db.query.membership.findFirst({
			where: and(eq(schema.membership.userId, user.id), eq(schema.membership.subcategoryId, sub.id)),
		});
		if (existing && JSON.stringify(existing.answers) === JSON.stringify(answers)) {
			return c.json({ summary: existing.summary, summarySource: existing.summarySource, changed: false });
		}

		const { summary, source } = await writeSummary(c.env, sub.name, prompts, answers);
		const now = new Date();
		await db
			.insert(schema.membership)
			.values({ userId: user.id, subcategoryId: sub.id, answers, summary, summarySource: source, updatedAt: now })
			.onConflictDoUpdate({
				target: [schema.membership.userId, schema.membership.subcategoryId],
				set: { answers, summary, summarySource: source, updatedAt: now },
			});
		return c.json({ summary, summarySource: source, changed: true });
	},
);

profileRoutes.delete("/memberships/:subcategoryId", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	await db
		.delete(schema.membership)
		.where(and(eq(schema.membership.userId, user.id), eq(schema.membership.subcategoryId, c.req.param("subcategoryId"))));
	return c.json({ ok: true });
});

/* ------------------------------------------------- category requests */

profileRoutes.post(
	"/requests",
	zValidator(
		"json",
		z.object({
			kind: z.enum(["category", "subcategory"]),
			categoryId: z.string().optional(),
			name: z.string().trim().min(3).max(60),
			note: z.string().trim().max(280).optional(),
		}),
	),
	async (c) => {
		const user = currentUser(c);
		const body = c.req.valid("json");
		if (body.kind === "subcategory" && !body.categoryId) {
			throw new HTTPException(400, { message: "Pick the category it belongs to" });
		}
		const db = getDb(c.env.DB);
		const [{ n }] = await db
			.select({ n: count() })
			.from(schema.categoryRequest)
			.where(and(eq(schema.categoryRequest.userId, user.id), eq(schema.categoryRequest.status, "pending")));
		if (n >= 5) throw new HTTPException(429, { message: "You already have 5 pending requests" });
		await db.insert(schema.categoryRequest).values({
			id: crypto.randomUUID(),
			userId: user.id,
			kind: body.kind,
			categoryId: body.kind === "subcategory" ? body.categoryId : null,
			name: body.name,
			note: body.note || null,
		});
		return c.json({ ok: true });
	},
);

profileRoutes.get("/requests", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	const rows = await db
		.select()
		.from(schema.categoryRequest)
		.where(eq(schema.categoryRequest.userId, user.id))
		.orderBy(asc(schema.categoryRequest.createdAt));
	return c.json({ requests: rows.reverse() });
});
