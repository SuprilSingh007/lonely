import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

const createdAt = () =>
	integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`);

/* ---------------------------------------------------------------- places */

export const suburb = sqliteTable("suburb", {
	id: text("id").primaryKey(), // slug, e.g. "wakad"
	name: text("name").notNull(),
	city: text("city").notNull().default("Pune"),
	sortOrder: integer("sort_order").notNull().default(0),
	active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/* -------------------------------------------------------------- taxonomy */

export const category = sqliteTable("category", {
	id: text("id").primaryKey(), // slug
	name: text("name").notNull(),
	emoji: text("emoji").notNull().default("✨"),
	blurb: text("blurb").notNull().default(""),
	sortOrder: integer("sort_order").notNull().default(0),
	active: integer("active", { mode: "boolean" }).notNull().default(true),
	createdAt: createdAt(),
});

export const subcategory = sqliteTable(
	"subcategory",
	{
		id: text("id").primaryKey(), // slug
		categoryId: text("category_id")
			.notNull()
			.references(() => category.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		emoji: text("emoji").notNull().default("✨"),
		blurb: text("blurb").notNull().default(""),
		sortOrder: integer("sort_order").notNull().default(0),
		active: integer("active", { mode: "boolean" }).notNull().default(true),
		createdAt: createdAt(),
	},
	(t) => [index("subcategory_category_idx").on(t.categoryId)],
);

/**
 * Admin-defined structured prompts. Answers are always picked from `options`
 * (never freeform) so profiles can't leak gender, names or other identity cues.
 * `template` is the no-AI fallback sentence, with `{answer}` as the placeholder.
 */
export const prompt = sqliteTable(
	"prompt",
	{
		id: text("id").primaryKey(),
		subcategoryId: text("subcategory_id")
			.notNull()
			.references(() => subcategory.id, { onDelete: "cascade" }),
		question: text("question").notNull(),
		kind: text("kind", { enum: ["single", "multi"] }).notNull().default("single"),
		options: text("options", { mode: "json" }).$type<string[]>().notNull(),
		maxSelect: integer("max_select").notNull().default(1),
		template: text("template").notNull().default("Picked {answer}."),
		sortOrder: integer("sort_order").notNull().default(0),
		active: integer("active", { mode: "boolean" }).notNull().default(true),
	},
	(t) => [index("prompt_subcategory_idx").on(t.subcategoryId)],
);

/* --------------------------------------------------------------- people */

export const profile = sqliteTable(
	"profile",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		handle: text("handle").notNull(),
		birthDate: text("birth_date").notNull(), // YYYY-MM-DD, only used to show age inside a chat
		suburbId: text("suburb_id")
			.notNull()
			.references(() => suburb.id),
		createdAt: createdAt(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(t) => [index("profile_suburb_idx").on(t.suburbId)],
);

export type Answers = Record<string, string[]>;

/** A user's answers + summary inside one subcategory. Joining = having a row here. */
export const membership = sqliteTable(
	"membership",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		subcategoryId: text("subcategory_id")
			.notNull()
			.references(() => subcategory.id, { onDelete: "cascade" }),
		answers: text("answers", { mode: "json" }).$type<Answers>().notNull(),
		summary: text("summary").notNull(),
		summarySource: text("summary_source", { enum: ["ai", "template"] }).notNull(),
		createdAt: createdAt(),
		// Bumped whenever answers change; a pass older than this re-surfaces the card.
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.subcategoryId] }),
		index("membership_subcategory_idx").on(t.subcategoryId),
	],
);

/* ------------------------------------------------------------- matching */

export const swipe = sqliteTable(
	"swipe",
	{
		id: text("id").primaryKey(),
		swiperId: text("swiper_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		targetId: text("target_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		subcategoryId: text("subcategory_id")
			.notNull()
			.references(() => subcategory.id, { onDelete: "cascade" }),
		suburbId: text("suburb_id").notNull(),
		direction: text("direction", { enum: ["left", "right"] }).notNull(),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("swipe_unique_idx").on(t.swiperId, t.targetId, t.subcategoryId),
		index("swipe_swiper_time_idx").on(t.swiperId, t.createdAt),
	],
);

/* ----------------------------------------------------------------- chat */

/** One conversation per pair of people. userA < userB (string order). */
export const conversation = sqliteTable(
	"conversation",
	{
		id: text("id").primaryKey(),
		userA: text("user_a")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		userB: text("user_b")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		initiatorId: text("initiator_id").notNull(),
		subcategoryId: text("subcategory_id")
			.notNull()
			.references(() => subcategory.id),
		createdAt: createdAt(),
		lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
		lastMessagePreview: text("last_message_preview"),
		lastSenderId: text("last_sender_id"),
		userALastReadAt: integer("user_a_last_read_at", { mode: "timestamp_ms" }),
		userBLastReadAt: integer("user_b_last_read_at", { mode: "timestamp_ms" }),
	},
	(t) => [
		uniqueIndex("conversation_pair_idx").on(t.userA, t.userB),
		index("conversation_user_b_idx").on(t.userB),
	],
);

export const message = sqliteTable(
	"message",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		senderId: text("sender_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: createdAt(),
	},
	(t) => [index("message_conversation_time_idx").on(t.conversationId, t.createdAt)],
);

/* --------------------------------------------------------------- safety */

export const block = sqliteTable(
	"block",
	{
		blockerId: text("blocker_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		blockedId: text("blocked_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		reason: text("reason"),
		conversationId: text("conversation_id"),
		createdAt: createdAt(),
	},
	(t) => [
		primaryKey({ columns: [t.blockerId, t.blockedId] }),
		index("block_blocked_idx").on(t.blockedId),
	],
);

/* ------------------------------------------------- taxonomy suggestions */

export const categoryRequest = sqliteTable(
	"category_request",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text("kind", { enum: ["category", "subcategory"] }).notNull(),
		categoryId: text("category_id"),
		name: text("name").notNull(),
		note: text("note"),
		status: text("status", { enum: ["pending", "approved", "rejected"] })
			.notNull()
			.default("pending"),
		createdAt: createdAt(),
		reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
	},
	(t) => [index("category_request_status_idx").on(t.status)],
);

/* ------------------------------------------------------------ dev only */

/** Latest OTP per phone when SMS_PROVIDER=console, so local dev works without SMS. */
export const devOtp = sqliteTable("dev_otp", {
	phoneNumber: text("phone_number").primaryKey(),
	code: text("code").notNull(),
	createdAt: createdAt(),
});
