import type { Answers } from "../db/schema";
import type { AppEnv } from "../types";

export type PromptDef = {
	id: string;
	question: string;
	template: string;
};

const AI_TIMEOUT_MS = 8000;

/** Runs a short Workers AI completion. Returns null when AI is unavailable (e.g. offline local dev). */
async function complete(env: AppEnv, system: string, user: string): Promise<string | null> {
	try {
		const run = env.AI.run(env.AI_MODEL as keyof AiModels, {
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: user },
			],
			max_tokens: 120,
			temperature: 0.9,
		} as never) as Promise<unknown>;
		const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), AI_TIMEOUT_MS));
		const result = (await Promise.race([run, timeout])) as
			| { response?: unknown; choices?: { message?: { content?: unknown } }[] }
			| null;
		const text = result?.response ?? result?.choices?.[0]?.message?.content;
		if (typeof text !== "string") return null;
		return clean(text);
	} catch (error) {
		console.warn("[ai] falling back to templates:", error instanceof Error ? error.message : error);
		return null;
	}
}

function clean(text: string): string | null {
	const out = text
		.trim()
		.replace(/^["'“”]+|["'“”]+$/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return out.length >= 10 ? out.slice(0, 280) : null;
}

const formatAnswer = (values: string[]) =>
	values.length <= 1 ? (values[0] ?? "") : `${values.slice(0, -1).join(", ")} & ${values.at(-1)}`;

function qa(prompts: PromptDef[], answers: Answers) {
	return prompts
		.filter((p) => answers[p.id]?.length)
		.map((p) => `Q: ${p.question}\nA: ${formatAnswer(answers[p.id])}`)
		.join("\n");
}

export function templateSummary(prompts: PromptDef[], answers: Answers): string {
	return prompts
		.filter((p) => answers[p.id]?.length)
		.map((p) => p.template.replace("{answer}", formatAnswer(answers[p.id])))
		.join(" ");
}

const SUMMARY_SYSTEM = `You write tiny, playful profile blurbs for an anonymous interest-matching app in Pune.
Rules:
- Third person, present tense, 1-2 short sentences, under 180 characters total.
- Personality-forward and a little witty, e.g. "Believes the best episode was the one on failure, not funding. Has opinions on UPI vs crypto."
- Use ONLY the answers given. Never invent facts.
- Never mention or hint at gender, pronouns, name, age, looks, religion, caste or location. Avoid "he", "she", "they" — start sentences with verbs.
- No emojis, no hashtags, no quotes around the output. Output only the blurb.`;

export async function writeSummary(
	env: AppEnv,
	subcategoryName: string,
	prompts: PromptDef[],
	answers: Answers,
): Promise<{ summary: string; source: "ai" | "template" }> {
	const ai = await complete(env, SUMMARY_SYSTEM, `Interest: ${subcategoryName}\n${qa(prompts, answers)}`);
	if (ai) return { summary: ai, source: "ai" };
	return { summary: templateSummary(prompts, answers), source: "template" };
}

const OPENER_SYSTEM = `You suggest a single opening chat message for someone who just swiped right on a stranger in an anonymous interest-matching app.
Rules:
- One or two sentences, under 160 characters, casual Indian English, warm and curious.
- Reference something specific from the other person's answers, ideally something both people share.
- End with an easy question. No pickup lines, no flirting, no compliments on looks.
- Never mention gender, age, names or locations. No emojis overload (max one). Output only the message.`;

type Side = { summary: string; answers: Answers };

export async function suggestOpener(
	env: AppEnv,
	subcategoryName: string,
	prompts: PromptDef[],
	me: Side | null,
	them: Side,
	seed = Math.random(),
): Promise<{ text: string; source: "ai" | "template" }> {
	const ai = await complete(
		env,
		OPENER_SYSTEM,
		`Shared interest: ${subcategoryName}\nTheir answers:\n${qa(prompts, them.answers)}\nTheir blurb: ${them.summary}${
			me ? `\nMy answers:\n${qa(prompts, me.answers)}` : ""
		}`,
	);
	if (ai) return { text: ai, source: "ai" };
	return { text: templateOpener(subcategoryName, prompts, me, them, seed), source: "template" };
}

export function templateOpener(
	subcategoryName: string,
	prompts: PromptDef[],
	me: Side | null,
	them: Side,
	seed = Math.random(),
): string {
	const answered = prompts.filter((p) => them.answers[p.id]?.length);
	const shared = answered
		.map((p) => ({
			p,
			common: (them.answers[p.id] ?? []).filter((a) => me?.answers[p.id]?.includes(a)),
		}))
		.filter((x) => x.common.length > 0);

	if (shared.length > 0) {
		const { p, common } = shared[Math.floor(seed * shared.length)];
		const pick = common[0];
		const lines = [
			`Okay, we both went with "${pick}" for "${p.question}" — what got you hooked?`,
			`Fellow "${pick}" person! How did that happen for you?`,
			`Finally someone else who picked "${pick}". Tell me your hottest take on it?`,
		];
		return lines[Math.floor(seed * 1000) % lines.length];
	}

	if (answered.length > 0) {
		const p = answered[Math.floor(seed * answered.length)];
		const pick = formatAnswer(them.answers[p.id]);
		const lines = [
			`"${pick}" for "${p.question}" — bold. What's the story behind that?`,
			`Your answer "${pick}" made me curious. Why that one?`,
			`I need the backstory on "${pick}". Go!`,
		];
		return lines[Math.floor(seed * 1000) % lines.length];
	}

	return `Hey! Another ${subcategoryName} person nearby — what pulled you into it?`;
}
