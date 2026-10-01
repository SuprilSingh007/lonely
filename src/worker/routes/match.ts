import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, type Db } from "../db";
import { suggestOpener } from "../lib/ai";
import { ageFrom } from "../lib/time";
import { currentUser } from "../middleware";
import type { AppEnv, HonoEnv } from "../types";
import { swipesUsedToday } from "./profile";

export const matchRoutes = new Hono<HonoEnv>();

async function requireProfile(db: Db, userId: string) {
	const profile = await db.query.profile.findFirst({ where: eq(schema.profile.userId, userId) });
	if (!profile) throw new HTTPException(409, { message: "onboarding_required" });
	return profile;
}

const pairOf = (a: string, b: string) => (a < b ? { userA: a, userB: b } : { userA: b, userB: a });

async function isBlockedEitherWay(db: Db, a: string, b: string) {
	const row = await db.query.block.findFirst({
		where: or(
			and(eq(schema.block.blockerId, a), eq(schema.block.blockedId, b)),
			and(eq(schema.block.blockerId, b), eq(schema.block.blockedId, a)),
		),
	});
	return Boolean(row);
}

function chatRoom(env: AppEnv, conversationId: string) {
	return env.CHAT_ROOM.getByName(conversationId);
}

/* ------------------------------------------------------------------ deck */

matchRoutes.get(
	"/deck",
	zValidator("query", z.object({ suburb: z.string().min(1), subcategory: z.string().min(1) })),
	async (c) => {
		const user = currentUser(c);
		const db = getDb(c.env.DB);
		await requireProfile(db, user.id);
		const { suburb, subcategory } = c.req.valid("query");

		const joined = await db.query.membership.findFirst({
			where: and(eq(schema.membership.userId, user.id), eq(schema.membership.subcategoryId, subcategory)),
		});
		if (!joined) throw new HTTPException(409, { message: "join_required" });

		// Random order. Right swipes and existing chats never come back; a pass comes back
		// only if that person has since updated their answers in this interest.
		const cards = await db.all<{ userId: string; handle: string; summary: string }>(sql`
			SELECT m.user_id AS userId, p.handle AS handle, m.summary AS summary
			FROM membership m
			JOIN profile p ON p.user_id = m.user_id
			WHERE m.subcategory_id = ${subcategory}
				AND p.suburb_id = ${suburb}
				AND m.user_id != ${user.id}
				AND NOT EXISTS (
					SELECT 1 FROM block b
					WHERE (b.blocker_id = ${user.id} AND b.blocked_id = m.user_id)
						OR (b.blocker_id = m.user_id AND b.blocked_id = ${user.id})
				)
				AND NOT EXISTS (
					SELECT 1 FROM swipe s
					WHERE s.swiper_id = ${user.id} AND s.target_id = m.user_id AND s.subcategory_id = m.subcategory_id
						AND (s.direction = 'right' OR s.created_at >= m.updated_at)
				)
				AND NOT EXISTS (
					SELECT 1 FROM conversation cv
					WHERE cv.user_a = min(${user.id}, m.user_id) AND cv.user_b = max(${user.id}, m.user_id)
				)
			ORDER BY random()
			LIMIT 15
		`);

		const used = await swipesUsedToday(db, user.id);
		const limit = Number(c.env.DAILY_SWIPE_LIMIT);
		return c.json({ cards, swipes: { used, limit, left: Math.max(0, limit - used) } });
	},
);

matchRoutes.post(
	"/deck/swipe",
	zValidator(
		"json",
		z.object({
			targetId: z.string().min(1),
			subcategoryId: z.string().min(1),
			suburbId: z.string().min(1),
			direction: z.enum(["left", "right"]),
		}),
	),
	async (c) => {
		const user = currentUser(c);
		const db = getDb(c.env.DB);
		await requireProfile(db, user.id);
		const { targetId, subcategoryId, suburbId, direction } = c.req.valid("json");
		if (targetId === user.id) throw new HTTPException(400, { message: "That's you!" });

		const limit = Number(c.env.DAILY_SWIPE_LIMIT);
		const used = await swipesUsedToday(db, user.id);
		if (used >= limit) {
			throw new HTTPException(429, { message: `That's all ${limit} swipes for today. Fresh deck at midnight!` });
		}

		const [mine, target] = await Promise.all([
			db.query.membership.findFirst({
				where: and(eq(schema.membership.userId, user.id), eq(schema.membership.subcategoryId, subcategoryId)),
			}),
			db.query.membership.findFirst({
				where: and(eq(schema.membership.userId, targetId), eq(schema.membership.subcategoryId, subcategoryId)),
			}),
		]);
		if (!mine) throw new HTTPException(409, { message: "join_required" });
		if (!target) throw new HTTPException(404, { message: "That card has left the deck" });
		if (await isBlockedEitherWay(db, user.id, targetId)) {
			throw new HTTPException(404, { message: "That card has left the deck" });
		}

		const now = new Date();
		await db
			.insert(schema.swipe)
			.values({ id: crypto.randomUUID(), swiperId: user.id, targetId, subcategoryId, suburbId, direction, createdAt: now })
			.onConflictDoUpdate({
				target: [schema.swipe.swiperId, schema.swipe.targetId, schema.swipe.subcategoryId],
				set: { direction, suburbId, createdAt: now },
			});

		let conversationId: string | null = null;
		if (direction === "right") {
			const pair = pairOf(user.id, targetId);
			const existing = await db.query.conversation.findFirst({
				where: and(eq(schema.conversation.userA, pair.userA), eq(schema.conversation.userB, pair.userB)),
			});
			conversationId = existing?.id ?? crypto.randomUUID();
			if (!existing) {
				await db
					.insert(schema.conversation)
					.values({ id: conversationId, ...pair, initiatorId: user.id, subcategoryId, createdAt: now })
					.onConflictDoNothing();
			}
		}

		return c.json({ conversationId, swipes: { used: used + 1, limit, left: Math.max(0, limit - used - 1) } });
	},
);

/* ----------------------------------------------------------------- chats */

async function loadConversation(db: Db, id: string, userId: string) {
	const conv = await db.query.conversation.findFirst({ where: eq(schema.conversation.id, id) });
	if (!conv || (conv.userA !== userId && conv.userB !== userId)) {
		throw new HTTPException(404, { message: "Chat not found" });
	}
	const otherId = conv.userA === userId ? conv.userB : conv.userA;
	return { conv, otherId, iAmA: conv.userA === userId };
}

matchRoutes.get("/chats", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	await requireProfile(db, user.id);

	const rows = await db.all<{
		id: string;
		initiatorId: string;
		otherId: string;
		otherHandle: string;
		subcategoryId: string;
		subName: string;
		subEmoji: string;
		createdAt: number;
		lastMessageAt: number | null;
		lastMessagePreview: string | null;
		lastSenderId: string | null;
		myLastReadAt: number | null;
	}>(sql`
		SELECT cv.id, cv.initiator_id AS initiatorId,
			CASE WHEN cv.user_a = ${user.id} THEN cv.user_b ELSE cv.user_a END AS otherId,
			p.handle AS otherHandle,
			cv.subcategory_id AS subcategoryId, s.name AS subName, s.emoji AS subEmoji,
			cv.created_at AS createdAt, cv.last_message_at AS lastMessageAt,
			cv.last_message_preview AS lastMessagePreview, cv.last_sender_id AS lastSenderId,
			CASE WHEN cv.user_a = ${user.id} THEN cv.user_a_last_read_at ELSE cv.user_b_last_read_at END AS myLastReadAt
		FROM conversation cv
		JOIN profile p ON p.user_id = CASE WHEN cv.user_a = ${user.id} THEN cv.user_b ELSE cv.user_a END
		JOIN subcategory s ON s.id = cv.subcategory_id
		WHERE (cv.user_a = ${user.id} OR cv.user_b = ${user.id})
			AND NOT EXISTS (
				SELECT 1 FROM block b
				WHERE (b.blocker_id = cv.user_a AND b.blocked_id = cv.user_b)
					OR (b.blocker_id = cv.user_b AND b.blocked_id = cv.user_a)
			)
		ORDER BY COALESCE(cv.last_message_at, cv.created_at) DESC
		LIMIT 200
	`);

	const chats = rows.map((r) => {
		const activityAt = r.lastMessageAt ?? r.createdAt;
		const unread =
			r.lastSenderId !== null
				? r.lastSenderId !== user.id && (r.myLastReadAt ?? 0) < (r.lastMessageAt ?? 0)
				: r.initiatorId !== user.id && r.myLastReadAt === null;
		return {
			id: r.id,
			other: { id: r.otherId, handle: r.otherHandle },
			subcategory: { id: r.subcategoryId, name: r.subName, emoji: r.subEmoji },
			theySwipedFirst: r.initiatorId !== user.id,
			lastMessage: r.lastMessagePreview
				? { body: r.lastMessagePreview, mine: r.lastSenderId === user.id, at: r.lastMessageAt }
				: null,
			activityAt,
			unread,
		};
	});
	return c.json({ chats, unreadCount: chats.filter((x) => x.unread).length });
});

matchRoutes.get("/chats/:id", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	const { conv, otherId, iAmA } = await loadConversation(db, c.req.param("id"), user.id);

	const [otherProfile, sub, theirMembership, myMembership, messages, blockedByMe, blockedMe] = await Promise.all([
		db.query.profile.findFirst({ where: eq(schema.profile.userId, otherId) }),
		db.query.subcategory.findFirst({ where: eq(schema.subcategory.id, conv.subcategoryId) }),
		db.query.membership.findFirst({
			where: and(eq(schema.membership.userId, otherId), eq(schema.membership.subcategoryId, conv.subcategoryId)),
		}),
		db.query.membership.findFirst({
			where: and(eq(schema.membership.userId, user.id), eq(schema.membership.subcategoryId, conv.subcategoryId)),
		}),
		db
			.select()
			.from(schema.message)
			.where(eq(schema.message.conversationId, conv.id))
			.orderBy(desc(schema.message.createdAt))
			.limit(300),
		db.query.block.findFirst({
			where: and(eq(schema.block.blockerId, user.id), eq(schema.block.blockedId, otherId)),
		}),
		db.query.block.findFirst({
			where: and(eq(schema.block.blockerId, otherId), eq(schema.block.blockedId, user.id)),
		}),
	]);
	if (blockedMe) throw new HTTPException(404, { message: "Chat not found" });

	const suburbName = otherProfile
		? (await db.query.suburb.findFirst({ where: eq(schema.suburb.id, otherProfile.suburbId) }))?.name
		: null;

	return c.json({
		chat: {
			id: conv.id,
			theySwipedFirst: conv.initiatorId !== user.id,
			createdAt: conv.createdAt.getTime(),
			subcategory: sub ? { id: sub.id, name: sub.name, emoji: sub.emoji } : null,
			blockedByMe: Boolean(blockedByMe),
			otherLastReadAt: (iAmA ? conv.userBLastReadAt : conv.userALastReadAt)?.getTime() ?? null,
		},
		me: { id: user.id, summary: myMembership?.summary ?? null },
		other: {
			id: otherId,
			handle: otherProfile?.handle ?? "Someone",
			// Age is revealed only once a chat exists.
			age: otherProfile ? ageFrom(otherProfile.birthDate) : null,
			suburb: suburbName ?? null,
			summary: theirMembership?.summary ?? null,
		},
		messages: messages.reverse().map((m) => ({
			id: m.id,
			senderId: m.senderId,
			body: m.body,
			createdAt: m.createdAt.getTime(),
		})),
	});
});

matchRoutes.get("/chats/:id/opener", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	const { conv, otherId } = await loadConversation(db, c.req.param("id"), user.id);
	const [sub, prompts, theirs, mine] = await Promise.all([
		db.query.subcategory.findFirst({ where: eq(schema.subcategory.id, conv.subcategoryId) }),
		db
			.select()
			.from(schema.prompt)
			.where(eq(schema.prompt.subcategoryId, conv.subcategoryId))
			.orderBy(asc(schema.prompt.sortOrder)),
		db.query.membership.findFirst({
			where: and(eq(schema.membership.userId, otherId), eq(schema.membership.subcategoryId, conv.subcategoryId)),
		}),
		db.query.membership.findFirst({
			where: and(eq(schema.membership.userId, user.id), eq(schema.membership.subcategoryId, conv.subcategoryId)),
		}),
	]);
	const subName = sub?.name ?? "this";
	if (!theirs) {
		return c.json({ text: `Hey! Fellow ${subName} fan — what got you into it?`, source: "template" });
	}
	const opener = await suggestOpener(
		c.env,
		subName,
		prompts,
		mine ? { summary: mine.summary, answers: mine.answers } : null,
		{ summary: theirs.summary, answers: theirs.answers },
	);
	return c.json(opener);
});

matchRoutes.post(
	"/chats/:id/messages",
	zValidator("json", z.object({ body: z.string().trim().min(1).max(1000), clientId: z.string().max(64).optional() })),
	async (c) => {
		const user = currentUser(c);
		const db = getDb(c.env.DB);
		const { conv, otherId, iAmA } = await loadConversation(db, c.req.param("id"), user.id);
		if (await isBlockedEitherWay(db, user.id, otherId)) {
			throw new HTTPException(403, { message: "You can't message this person" });
		}
		const { body, clientId } = c.req.valid("json");
		const now = new Date();
		const id = crypto.randomUUID();
		await db.batch([
			db.insert(schema.message).values({ id, conversationId: conv.id, senderId: user.id, body, createdAt: now }),
			db
				.update(schema.conversation)
				.set({
					lastMessageAt: now,
					lastMessagePreview: body.slice(0, 140),
					lastSenderId: user.id,
					...(iAmA ? { userALastReadAt: now } : { userBLastReadAt: now }),
				})
				.where(eq(schema.conversation.id, conv.id)),
		]);
		const message = { id, senderId: user.id, body, createdAt: now.getTime(), clientId };
		try {
			await chatRoom(c.env, conv.id).broadcast({ type: "message", message });
		} catch (error) {
			// The message is saved; clients will pick it up on their next fetch.
			console.error("broadcast failed", error);
		}
		return c.json({ message });
	},
);

matchRoutes.post("/chats/:id/read", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	const { conv, iAmA } = await loadConversation(db, c.req.param("id"), user.id);
	const now = new Date();
	await db
		.update(schema.conversation)
		.set(iAmA ? { userALastReadAt: now } : { userBLastReadAt: now })
		.where(eq(schema.conversation.id, conv.id));
	try {
		await chatRoom(c.env, conv.id).broadcast({ type: "read", userId: user.id, at: now.getTime() });
	} catch {
		// non-critical
	}
	return c.json({ ok: true });
});

matchRoutes.get("/chats/:id/ws", async (c) => {
	const user = currentUser(c);
	if (c.req.header("Upgrade") !== "websocket") {
		throw new HTTPException(426, { message: "Expected a WebSocket upgrade" });
	}
	const db = getDb(c.env.DB);
	const { conv, otherId } = await loadConversation(db, c.req.param("id"), user.id);
	if (await isBlockedEitherWay(db, user.id, otherId)) throw new HTTPException(403, { message: "Blocked" });

	const headers = new Headers(c.req.raw.headers);
	headers.set("x-user-id", user.id);
	return chatRoom(c.env, conv.id).fetch(new Request(c.req.raw.url, { headers }));
});

/* ---------------------------------------------------------------- blocks */

matchRoutes.post(
	"/blocks",
	zValidator(
		"json",
		z.object({
			userId: z.string().min(1),
			conversationId: z.string().optional(),
			reason: z.string().trim().max(500).optional(),
		}),
	),
	async (c) => {
		const user = currentUser(c);
		const { userId, conversationId, reason } = c.req.valid("json");
		if (userId === user.id) throw new HTTPException(400, { message: "You can't block yourself" });
		const db = getDb(c.env.DB);
		await db
			.insert(schema.block)
			.values({ blockerId: user.id, blockedId: userId, reason: reason || null, conversationId: conversationId ?? null })
			.onConflictDoNothing();

		const pair = pairOf(user.id, userId);
		const conv = await db.query.conversation.findFirst({
			where: and(eq(schema.conversation.userA, pair.userA), eq(schema.conversation.userB, pair.userB)),
		});
		if (conv) {
			try {
				const room = chatRoom(c.env, conv.id);
				await room.broadcast({ type: "blocked", by: user.id });
				await room.closeAll("blocked");
			} catch {
				// non-critical
			}
		}
		return c.json({ ok: true });
	},
);

matchRoutes.get("/blocks", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	const rows = await db
		.select({ userId: schema.block.blockedId, handle: schema.profile.handle, createdAt: schema.block.createdAt })
		.from(schema.block)
		.leftJoin(schema.profile, eq(schema.profile.userId, schema.block.blockedId))
		.where(eq(schema.block.blockerId, user.id))
		.orderBy(desc(schema.block.createdAt));
	return c.json({ blocks: rows });
});

matchRoutes.delete("/blocks/:userId", async (c) => {
	const user = currentUser(c);
	const db = getDb(c.env.DB);
	await db
		.delete(schema.block)
		.where(and(eq(schema.block.blockerId, user.id), eq(schema.block.blockedId, c.req.param("userId"))));
	return c.json({ ok: true });
});
