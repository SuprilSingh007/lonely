# Ghulo Milo

Anonymous, interest-based local matching for Pune. People pick a suburb and a very specific interest (say *Nikhil Kamath's WTF podcast*) and swipe through anonymous cards: a quirky handle plus a blurb written from their answers to structured prompts. A right swipe opens a chat straight away. There are no photos, names or gender, and age only appears inside a chat.

Everything runs on Cloudflare:

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + Vite, React Router, TanStack Query, [shadcn/ui](https://ui.shadcn.com) on Tailwind v4, motion (swipe gestures) |
| Backend | [Hono](https://hono.dev) in a Cloudflare Worker (`src/worker`) |
| Auth | [Better Auth](https://better-auth.com), phone number + OTP plugin |
| Database | **D1** for all data (auth, profiles, taxonomy, swipes, chats, blocks). Schema in Drizzle ORM, SQL migrations in `migrations/` |
| Realtime chat | **Durable Objects**: one `ChatRoom` per conversation using the WebSocket Hibernation API, in the spirit of Cloudflare's [realtime chat tutorial](https://developers.cloudflare.com/workers/tutorials/deploy-a-realtime-chat-app/) |
| AI | **Workers AI** writes profile blurbs and opening lines. It falls back to built-in templates when AI isn't reachable (e.g. offline local dev) |
| Hosting | Workers Static Assets (SPA) and the Worker API, all in one Worker |

The design language is in [`design.md`](./design.md).

## Run it locally (no Cloudflare account needed)

Requires Node.js 22+.

```bash
npm install
npm run setup   # creates .dev.vars with a random auth secret, applies D1 migrations locally, seeds 48 demo people
npm run dev     # http://localhost:5173
```

- **Signing in locally:** `SMS_PROVIDER` is `console`, so no SMS is sent. The login screen shows the code in a "🧪 Dev mode" box, and it's also printed in the terminal. Any Indian mobile number works (e.g. `98765 43210`).
- **Admin panel:** sign in with **`99999 99999`** (the `ADMIN_PHONE_NUMBERS` var in `wrangler.json`) and open **Admin** in the nav.
- **Demo people:** they live in Wagholi, Hadapsar, Wakad and Baner. Join *Nikhil Kamath's WTF podcast*, *Sahyadri treks*, *Indian indie*, *AI tinkering* or *Anime* to get a full deck. You can also sign in *as* a demo person with `90000 00001` … `90000 00048`, which is handy for testing chat in two browser windows.
- **Workers AI locally:** it only runs on Cloudflare, so plain `npm run dev` uses the template blurbs and openers. To use the real models locally, run `npx wrangler login` and then `npm run dev:ai`.
- **Reset local data:** `npm run db:reset:local`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run setup` | Local `.dev.vars`, D1 migrations and demo seed data (safe to re-run) |
| `npm run dev` | Vite + the Worker in local `workerd`, with D1 and Durable Objects simulated locally |
| `npm run dev:ai` | Same, with remote bindings on so Workers AI works (needs `wrangler login`) |
| `npm run preview` | Production build served locally by `workerd` |
| `npm run build` | Typecheck and build client + Worker |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Browser end-to-end test against a running dev server (see below) |
| `npm run db:generate` | Generate a new SQL migration after editing `src/worker/db/schema.ts` |
| `npm run auth:generate` | Regenerate the Better Auth tables (`src/worker/db/auth-schema.ts`) after changing auth plugins |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply migrations to the local or production D1 |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after changing `wrangler.json` |
| `npm run deploy` | Build, apply remote D1 migrations, `wrangler deploy` |

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create ghulo-milo        # copy the database_id it prints into wrangler.json
npx wrangler secret put BETTER_AUTH_SECRET   # any long random string, e.g. `openssl rand -hex 32`
npm run deploy                            # builds, migrates remote D1 (incl. the Pune taxonomy), deploys
```

Then, before real users:

1. **Real SMS.** Set `"SMS_PROVIDER": "twilio"` in `wrangler.json` and add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` with `wrangler secret put`. Indian SMS needs DLT registration. `src/worker/lib/sms.ts` is the single place to add another provider, such as MSG91.
2. **Admin number.** Put your real number in `ADMIN_PHONE_NUMBERS` (comma-separated, E.164 format, e.g. `+919812345678`).
3. **Base URL.** Optionally set `BETTER_AUTH_URL` (secret or var) to your public URL.

Demo users are **never** deployed. They only go into the local database.

## How the product rules are implemented

| PRD rule | Where |
| --- | --- |
| Phone + OTP sign-up, one account per number, +91 mobiles only | Better Auth `phoneNumber` plugin in `src/worker/auth-options.ts`. The OTP endpoints are rate-limited, with counters stored in D1. |
| Fixed quirky handle, never editable | Generated at sign-up (`src/worker/lib/handles.ts`) and stored as the user's name |
| Age hidden while browsing, revealed in chat | Deck API returns only handle + summary. Chat API adds `age`. |
| Structured prompts only (no freeform bio) | Admin-defined `prompt` rows. Answers are validated against the options. |
| AI summary per interest | Workers AI (`src/worker/lib/ai.ts`), with a template fallback per prompt |
| Deck = suburb + subcategory, random order | `GET /api/deck` (`ORDER BY random()`) |
| 20 swipes/day | Counted from IST midnight (`DAILY_SWIPE_LIMIT`) |
| One-way right swipe opens a chat with an AI opener | `POST /api/deck/swipe` creates the conversation. `GET /api/chats/:id/opener` suggests the first line. |
| See who swiped right on you | "Swiped right on you" row in Chats |
| Re-surfacing | Passed cards come back only if that person updates their answers. Right swipes and existing chats never repeat. |
| Text-only realtime chat | REST send → D1 → `ChatRoom` Durable Object broadcast. Typing, presence and "Seen" go over the same socket. |
| Block (only safety control) + manual review | Block hides both people from each other everywhere and ends the live chat. The admin **Safety** tab lists blocks with reasons and the chat for review. |
| Admin-curated taxonomy + user requests | Admin **Taxonomy** and **Requests** tabs. Approved requests become draft interests that go live once they have prompts. |
| Cold-start density | Admin **Overview** shows a people-per-suburb×interest grid |

## End-to-end test

`scripts/e2e.mjs` drives a real Chromium browser through the whole product:
- a desktop user and a phone user sign up with OTP and onboard
- both join an interest
- the phone user passes cards, then drags one to the right
- the chat opens with an opener and they chat in realtime (message, typing indicator, "Seen")
- the phone user suggests an interest and blocks the other user
- an admin on a tablet approves the suggestion and reviews the block

```bash
npm i -D playwright && npx playwright install chromium   # one-time
npm run dev               # terminal 1
npm run test:e2e          # terminal 2. Screenshots in .e2e-artifacts/
```

## Project layout

```
src/
  worker/
    index.ts            Hono app: /api/auth/*, /api/* routes, exports ChatRoom
    auth.ts             Better Auth instance (D1 via Drizzle)
    auth-options.ts     Shared auth config (also used by the auth CLI via auth.config.ts)
    chat-room.ts        ChatRoom Durable Object (hibernatable WebSockets)
    routes/             profile.ts (me, interests, requests), match.ts (deck, swipes, chats, blocks), admin.ts
    lib/                ai.ts (Workers AI + fallbacks), sms.ts, handles.ts, time.ts
    db/                 schema.ts (app tables), auth-schema.ts (generated)
  react-app/
    pages/              landing, login, onboarding, discover, deck, interests, chats, chat-room, me, admin
    components/         app-shell (responsive nav), brand (logo, blob avatars, stickers), ui/ (shadcn)
    hooks/              data hooks, chat WebSocket hook
migrations/             D1 SQL: 0000 schema, 0001 Pune taxonomy seed
scripts/                setup, demo seed, taxonomy source + SQL generator, e2e test
design.md               Design language
```

## How this project was generated

1. `npm create cloudflare@latest -- lonely --template=cloudflare/templates/vite-react-template` (from the [Cloudflare Hono guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/))
2. shadcn/ui, following the [Vite guide](https://ui.shadcn.com/docs/installation/vite): `npx shadcn@latest init -b radix -p nova`, then `npx shadcn@latest add …` for each component
3. Better Auth tables via `npx auth generate`, D1 migrations via `drizzle-kit generate`
