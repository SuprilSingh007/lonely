# Lonely

Full-stack app on Cloudflare Workers.

- **Frontend:** React 19 + Vite, [shadcn/ui](https://ui.shadcn.com) (Radix base, Nova preset) on Tailwind CSS v4 — `src/react-app/`
- **Backend:** [Hono](https://hono.dev) running in a Worker — `src/worker/`
- **Local runtime:** [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/) runs the Worker in `workerd` (the real Workers runtime) during `vite dev` / `vite preview`, with local emulation of bindings (Durable Objects, KV, D1, R2, …). No Cloudflare account is needed to develop.

## Requirements

- Node.js 22+ and npm

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 — React with HMR + Hono API at /api/*
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with the Worker running in local `workerd` |
| `npm run build` | Typecheck (`tsc -b`) and build client + Worker into `dist/` |
| `npm run preview` | Build, then serve the production build locally in `workerd` |
| `npm run lint` | ESLint |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after changing `wrangler.json` |
| `npm run deploy` | `wrangler deploy` (requires `wrangler login`) |

## Project layout

```
src/
  react-app/            # SPA (served as static assets)
    components/ui/      # shadcn/ui components — add more with `npx shadcn@latest add <name>`
    lib/utils.ts        # cn() helper
    index.css           # Tailwind + shadcn theme tokens
  worker/index.ts       # Hono app (handles /api/*)
wrangler.json           # Worker config, bindings, compatibility date
components.json         # shadcn/ui config (`@/` → src/react-app)
```

Routing: requests that match a built asset are served directly; other browser navigations fall back to `index.html` (`not_found_handling: "single-page-application"`); everything else (e.g. `/api/*`) reaches the Hono Worker.

## How this project was generated

1. `npm create cloudflare@latest -- lonely --template=cloudflare/templates/vite-react-template` ([Cloudflare Hono guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/))
2. shadcn/ui per the [Vite "existing project" guide](https://ui.shadcn.com/docs/installation/vite): `tailwindcss` + `@tailwindcss/vite`, `@/*` path alias pointed at `src/react-app`, then `npx shadcn@latest init -b radix -p nova` and `npx shadcn@latest add button card`
