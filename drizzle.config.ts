import { defineConfig } from "drizzle-kit";

// drizzle-kit only generates SQL here; Wrangler applies it to D1
// (`npm run db:migrate:local` / `npm run db:migrate:remote`).
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/worker/db/schema.ts",
	out: "./migrations",
});
