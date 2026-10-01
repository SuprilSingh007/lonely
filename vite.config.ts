import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		cloudflare({
			// Workers AI only runs remotely. Keep local dev fully offline by default;
			// `npm run dev:ai` (after `npx wrangler login`) turns remote bindings on.
			remoteBindings: process.env.REMOTE_BINDINGS === "true",
		}),
	],
	build: {
		// One ~260 kB gzipped app bundle is fine for the MVP; the admin panel is lazy-loaded.
		// (Hand-rolled vendor manualChunks caused circular chunk init in production builds.)
		chunkSizeWarningLimit: 900,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src/react-app"),
		},
	},
});
