// One-shot local setup: creates .dev.vars, applies D1 migrations locally, and (with --seed) loads demo users.
// Runs automatically before `npm run dev` / `npm run preview` (without --seed).
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const root = new URL("..", import.meta.url);
const devVars = new URL(".dev.vars", root);
if (!existsSync(devVars)) {
	const example = readFileSync(new URL(".dev.vars.example", root), "utf8");
	writeFileSync(devVars, example.replace("replace-me-with-32-plus-random-chars", randomBytes(32).toString("hex")));
	console.log("Created .dev.vars with a fresh BETTER_AUTH_SECRET");
}

const run = (cmd) => execSync(cmd, {
		stdio: process.argv.includes("--quiet") ? "pipe" : "inherit",
		cwd: root,
		// Skip Wrangler confirmation prompts for the local database.
		env: { ...process.env, CI: "true" },
	});
run("npx wrangler d1 migrations apply DB --local");
if (process.argv.includes("--seed")) {
	run("node scripts/seed-demo.mjs");
}
