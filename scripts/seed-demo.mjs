// Seeds the LOCAL D1 database with demo people so decks aren't empty in development.
// Every demo user can sign in: phone +91 90000 000NN, OTP shown in dev mode.
// Safe to re-run (INSERT OR IGNORE).
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { categories, suburbs } from "./taxonomy.mjs";

const ADJ = ["Caffeinated", "Philosophical", "Sleepy", "Spicy", "Curious", "Dramatic", "Sneaky", "Monsoon", "Midnight", "Chatty", "Cosmic", "Tangy", "Bookish", "Zesty", "Nerdy", "Fizzy", "Jazzy", "Plucky", "Retro", "Velvet", "Wandering", "Breezy", "Crunchy", "Dreamy"];
const NOUN = ["Pangolin", "Samosa", "Otter", "Vadapav", "Peacock", "Mango", "Narwhal", "Chakli", "Koel", "Tamarind", "Sloth", "Rickshaw", "Modak", "Hornbill", "Falooda", "Jalebi", "Gecko", "Firefly", "Kulfi", "Misal", "Poha", "Quokka", "Capybara", "Axolotl"];

// Deterministic PRNG so every machine gets the same demo crowd.
let s = 42;
const rand = () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = (a) => a[Math.floor(rand() * a.length)];
const q = (v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const subs = categories.flatMap((c) => c.subcategories);
// Popular interests get more people, so a few decks are nicely full.
const popular = ["nikhil-kamath-podcast", "sahyadri-treks", "indian-indie", "ai-tinkering", "anime"];
const fmt = (v) => (v.length <= 1 ? v[0] : `${v.slice(0, -1).join(", ")} & ${v.at(-1)}`);

const lines = [];
const now = Date.now();
for (let i = 1; i <= 48; i++) {
	const id = `demo-user-${String(i).padStart(2, "0")}`;
	const phone = `+9190000000${String(i).padStart(2, "0")}`;
	const handle = `${ADJ[(i * 7) % ADJ.length]} ${NOUN[(i * 11) % NOUN.length]} ${10 + ((i * 37) % 90)}`;
	const suburb = suburbs[i % suburbs.length].id;
	const year = 1985 + Math.floor(rand() * 20);
	const birth = `${year}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`;
	const t = now - i * 3600_000;
	lines.push(
		`INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at, phone_number, phone_number_verified) VALUES (${q(id)}, ${q(handle)}, ${q(`${phone.slice(1)}@phone.ghulomilo.invalid`)}, 0, ${t}, ${t}, ${q(phone)}, 1);`,
		`INSERT OR IGNORE INTO profile (user_id, handle, birth_date, suburb_id, created_at, updated_at) VALUES (${q(id)}, ${q(handle)}, ${q(birth)}, ${q(suburb)}, ${t}, ${t});`,
	);

	const mine = new Set([popular[i % popular.length], popular[(i + 2) % popular.length]]);
	while (mine.size < 2 + (i % 3)) mine.add(pick(subs).id);
	for (const subId of mine) {
		const sub = subs.find((x) => x.id === subId);
		const answers = {};
		const parts = [];
		sub.prompts.forEach((p, pi) => {
			const n = p.kind === "multi" ? 1 + Math.floor(rand() * p.maxSelect) : 1;
			const chosen = [...new Set(Array.from({ length: n }, () => pick(p.options)))];
			answers[`${sub.id}-q${pi + 1}`] = chosen;
			parts.push(p.template.replace("{answer}", fmt(chosen)));
		});
		lines.push(
			`INSERT OR IGNORE INTO membership (user_id, subcategory_id, answers, summary, summary_source, created_at, updated_at) VALUES (${q(id)}, ${q(subId)}, ${q(JSON.stringify(answers))}, ${q(parts.join(" "))}, 'template', ${t}, ${t});`,
		);
	}
}

mkdirSync(new URL("../.wrangler", import.meta.url), { recursive: true });
const file = new URL("../.wrangler/seed-demo.sql", import.meta.url);
writeFileSync(file, lines.join("\n") + "\n");
execSync("npx wrangler d1 execute DB --local --file .wrangler/seed-demo.sql", {
	stdio: "inherit",
	cwd: new URL("..", import.meta.url),
});
console.log("Seeded 48 demo users (+91 90000 00001 … +91 90000 00048).");
