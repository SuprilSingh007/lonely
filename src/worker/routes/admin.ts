import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, type Db } from "../db";
import { requireAdmin } from "../middleware";
import type { HonoEnv } from "../types";

export const adminRoutes = new Hono<HonoEnv>();
adminRoutes.use("*", requireAdmin);

const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48) || crypto.randomUUID().slice(0, 8);

async function uniqueId(db: Db, table: typeof schema.category | typeof schema.subcategory | typeof schema.suburb, base: string) {
	let id = slugify(base);
	for (let i = 2; ; i++) {
		const [{ n }] = await db.select({ n: count() }).from(table).where(eq(table.id, id));
		if (n === 0) return id;
		id = `${slugify(base)}-${i}`;
	}
}

adminRoutes.get("/overview", async (c) => {
	const db = getDb(c.env.DB);
	const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
	const [users, profiles, memberships, conversations, messages, pendingRequests, blocks] = await Promise.all([
		one(db.select({ n: count() }).from(schema.user)),
		one(db.select({ n: count() }).from(schema.profile)),
		one(db.select({ n: count() }).from(schema.membership)),
		one(db.select({ n: count() }).from(schema.conversation)),
		one(db.select({ n: count() }).from(schema.message)),
		one(db.select({ n: count() }).from(schema.categoryRequest).where(eq(schema.categoryRequest.status, "pending"))),
		one(db.select({ n: count() }).from(schema.block)),
	]);
	// People per suburb × interest — the cold-start density check from the PRD.
	const density = await db.all<{ suburbId: string; subcategoryId: string; n: number }>(sql`
		SELECT p.suburb_id AS suburbId, m.subcategory_id AS subcategoryId, count(*) AS n
		FROM membership m JOIN profile p ON p.user_id = m.user_id
		GROUP BY p.suburb_id, m.subcategory_id
	`);
	return c.json({
		stats: { users, profiles, memberships, conversations, messages, pendingRequests, blocks },
		density,
	});
});

/* -------------------------------------------------------------- taxonomy */

adminRoutes.get("/taxonomy", async (c) => {
	const db = getDb(c.env.DB);
	const [suburbs, categories, subcategories, prompts] = await Promise.all([
		db.select().from(schema.suburb).orderBy(asc(schema.suburb.sortOrder)),
		db.select().from(schema.category).orderBy(asc(schema.category.sortOrder)),
		db.select().from(schema.subcategory).orderBy(asc(schema.subcategory.sortOrder)),
		db.select().from(schema.prompt).orderBy(asc(schema.prompt.sortOrder)),
	]);
	return c.json({
		suburbs,
		categories: categories.map((cat) => ({
			...cat,
			subcategories: subcategories
				.filter((s) => s.categoryId === cat.id)
				.map((s) => ({ ...s, prompts: prompts.filter((p) => p.subcategoryId === s.id) })),
		})),
	});
});

const name = z.string().trim().min(2).max(60);
const emoji = z.string().trim().min(1).max(8);
const blurb = z.string().trim().max(160);

adminRoutes.post("/suburbs", zValidator("json", z.object({ name })), async (c) => {
	const db = getDb(c.env.DB);
	const body = c.req.valid("json");
	const id = await uniqueId(db, schema.suburb, body.name);
	const [{ n }] = await db.select({ n: count() }).from(schema.suburb);
	await db.insert(schema.suburb).values({ id, name: body.name, sortOrder: n });
	return c.json({ id });
});

adminRoutes.patch(
	"/suburbs/:id",
	zValidator("json", z.object({ name: name.optional(), active: z.boolean().optional() })),
	async (c) => {
		const db = getDb(c.env.DB);
		await db.update(schema.suburb).set(c.req.valid("json")).where(eq(schema.suburb.id, c.req.param("id")));
		return c.json({ ok: true });
	},
);

adminRoutes.post(
	"/categories",
	zValidator("json", z.object({ name, emoji: emoji.default("✨"), blurb: blurb.default("") })),
	async (c) => {
		const db = getDb(c.env.DB);
		const body = c.req.valid("json");
		const id = await uniqueId(db, schema.category, body.name);
		const [{ n }] = await db.select({ n: count() }).from(schema.category);
		await db.insert(schema.category).values({ id, ...body, sortOrder: n });
		return c.json({ id });
	},
);

adminRoutes.patch(
	"/categories/:id",
	zValidator(
		"json",
		z.object({ name: name.optional(), emoji: emoji.optional(), blurb: blurb.optional(), active: z.boolean().optional() }),
	),
	async (c) => {
		const db = getDb(c.env.DB);
		await db.update(schema.category).set(c.req.valid("json")).where(eq(schema.category.id, c.req.param("id")));
		return c.json({ ok: true });
	},
);

const newSubcategory = z.object({
	categoryId: z.string().min(1),
	name,
	emoji: emoji.default("✨"),
	blurb: blurb.default(""),
	// New interests start paused so the admin can add prompts before people join.
	active: z.boolean().default(false),
});

async function createSubcategory(db: Db, body: z.infer<typeof newSubcategory>) {
	const parent = await db.query.category.findFirst({ where: eq(schema.category.id, body.categoryId) });
	if (!parent) throw new HTTPException(400, { message: "Unknown category" });
	const id = await uniqueId(db, schema.subcategory, body.name);
	const [{ n }] = await db
		.select({ n: count() })
		.from(schema.subcategory)
		.where(eq(schema.subcategory.categoryId, body.categoryId));
	await db.insert(schema.subcategory).values({ id, ...body, sortOrder: n });
	return id;
}

adminRoutes.post("/subcategories", zValidator("json", newSubcategory), async (c) => {
	const id = await createSubcategory(getDb(c.env.DB), c.req.valid("json"));
	return c.json({ id });
});

adminRoutes.patch(
	"/subcategories/:id",
	zValidator(
		"json",
		z.object({ name: name.optional(), emoji: emoji.optional(), blurb: blurb.optional(), active: z.boolean().optional() }),
	),
	async (c) => {
		const db = getDb(c.env.DB);
		const body = c.req.valid("json");
		const id = c.req.param("id");
		if (body.active) {
			const [{ n }] = await db
				.select({ n: count() })
				.from(schema.prompt)
				.where(sql`${schema.prompt.subcategoryId} = ${id} AND ${schema.prompt.active} = 1`);
			if (n === 0) throw new HTTPException(400, { message: "Add at least one prompt before going live" });
		}
		await db.update(schema.subcategory).set(body).where(eq(schema.subcategory.id, id));
		return c.json({ ok: true });
	},
);

const promptBody = z
	.object({
		question: z.string().trim().min(5).max(140),
		kind: z.enum(["single", "multi"]),
		options: z.array(z.string().trim().min(1).max(60)).min(2).max(8),
		maxSelect: z.number().int().min(1).max(6).default(1),
		template: z
			.string()
			.trim()
			.min(3)
			.max(140)
			.refine((t) => t.includes("{answer}"), "Template needs an {answer} placeholder"),
	})
	.refine((p) => new Set(p.options).size === p.options.length, "Options must be unique");

adminRoutes.post(
	"/prompts",
	zValidator("json", z.object({ subcategoryId: z.string().min(1) }).and(promptBody)),
	async (c) => {
		const db = getDb(c.env.DB);
		const body = c.req.valid("json");
		const [{ n }] = await db
			.select({ n: count() })
			.from(schema.prompt)
			.where(eq(schema.prompt.subcategoryId, body.subcategoryId));
		const id = `${body.subcategoryId}-${crypto.randomUUID().slice(0, 8)}`;
		await db.insert(schema.prompt).values({
			id,
			...body,
			maxSelect: body.kind === "single" ? 1 : Math.min(body.maxSelect, body.options.length),
			sortOrder: n,
		});
		return c.json({ id });
	},
);

adminRoutes.patch(
	"/prompts/:id",
	zValidator("json", z.object({ active: z.boolean() })),
	async (c) => {
		const db = getDb(c.env.DB);
		await db.update(schema.prompt).set(c.req.valid("json")).where(eq(schema.prompt.id, c.req.param("id")));
		return c.json({ ok: true });
	},
);

/* -------------------------------------------------------------- requests */

adminRoutes.get("/requests", async (c) => {
	const db = getDb(c.env.DB);
	const rows = await db
		.select({
			id: schema.categoryRequest.id,
			kind: schema.categoryRequest.kind,
			categoryId: schema.categoryRequest.categoryId,
			name: schema.categoryRequest.name,
			note: schema.categoryRequest.note,
			status: schema.categoryRequest.status,
			createdAt: schema.categoryRequest.createdAt,
			handle: schema.profile.handle,
		})
		.from(schema.categoryRequest)
		.leftJoin(schema.profile, eq(schema.profile.userId, schema.categoryRequest.userId))
		.orderBy(desc(schema.categoryRequest.createdAt))
		.limit(200);
	return c.json({ requests: rows });
});

adminRoutes.post(
	"/requests/:id",
	zValidator("json", z.object({ status: z.enum(["approved", "rejected"]) })),
	async (c) => {
		const db = getDb(c.env.DB);
		const req = await db.query.categoryRequest.findFirst({ where: eq(schema.categoryRequest.id, c.req.param("id")) });
		if (!req) throw new HTTPException(404, { message: "Request not found" });
		if (req.status !== "pending") throw new HTTPException(400, { message: "Already reviewed" });
		const { status } = c.req.valid("json");

		let createdId: string | null = null;
		if (status === "approved") {
			if (req.kind === "category") {
				createdId = await uniqueId(db, schema.category, req.name);
				const [{ n }] = await db.select({ n: count() }).from(schema.category);
				await db.insert(schema.category).values({ id: createdId, name: req.name, sortOrder: n });
			} else {
				createdId = await createSubcategory(db, {
					categoryId: req.categoryId ?? "",
					name: req.name,
					emoji: "✨",
					blurb: "",
					active: false,
				});
			}
		}
		await db
			.update(schema.categoryRequest)
			.set({ status, reviewedAt: new Date() })
			.where(eq(schema.categoryRequest.id, req.id));
		return c.json({ ok: true, createdId });
	},
);

/* ---------------------------------------------------------------- safety */

adminRoutes.get("/blocks", async (c) => {
	const db = getDb(c.env.DB);
	const rows = await db.all<{
		blockerId: string;
		blockedId: string;
		blocker: string | null;
		blocked: string | null;
		blockedPhone: string | null;
		reason: string | null;
		conversationId: string | null;
		createdAt: number;
		timesBlocked: number;
	}>(sql`
		SELECT b.blocker_id AS blockerId, b.blocked_id AS blockedId,
			pb.handle AS blocker, pd.handle AS blocked, u.phone_number AS blockedPhone,
			b.reason, b.conversation_id AS conversationId, b.created_at AS createdAt,
			(SELECT count(*) FROM block b2 WHERE b2.blocked_id = b.blocked_id) AS timesBlocked
		FROM block b
		LEFT JOIN profile pb ON pb.user_id = b.blocker_id
		LEFT JOIN profile pd ON pd.user_id = b.blocked_id
		LEFT JOIN user u ON u.id = b.blocked_id
		ORDER BY b.created_at DESC
		LIMIT 200
	`);
	return c.json({ blocks: rows });
});

/** Manual review of a reported chat: only reachable for conversations that ended in a block. */
adminRoutes.get("/blocks/:conversationId/messages", async (c) => {
	const db = getDb(c.env.DB);
	const id = c.req.param("conversationId");
	const blocked = await db.query.block.findFirst({ where: eq(schema.block.conversationId, id) });
	if (!blocked) throw new HTTPException(404, { message: "No block on this chat" });
	const rows = await db
		.select({
			id: schema.message.id,
			body: schema.message.body,
			createdAt: schema.message.createdAt,
			handle: schema.profile.handle,
		})
		.from(schema.message)
		.leftJoin(schema.profile, eq(schema.profile.userId, schema.message.senderId))
		.where(eq(schema.message.conversationId, id))
		.orderBy(desc(schema.message.createdAt))
		.limit(50);
	return c.json({ messages: rows.reverse() });
});
