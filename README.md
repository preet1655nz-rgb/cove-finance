# Cove

A quiet income and expense tracker. Website and PWA. Full-stack: React frontend + Nitro/Vercel backend.

## Surfaces

| Surface | URL | What it is |
| --- | --- | --- |
| Full-stack app + PWA | https://cove-finance.vercel.app/ | Tracker you can use in the browser or Add to Home Screen |
| In-app website | https://cove-finance.vercel.app/welcome | Marketing + product site inside the same app |
| Public website | https://cove-website-phi.vercel.app/ | Public landing (source: `website/index.html`) |
| Source backup | https://github.com/preet1655nz-rgb/cove-finance | GitHub `main` |

### PWA

- Manifest: `/manifest.webmanifest` (Cove name, icons, standalone)
- Service worker: `/sw.js` (offline shell)
- iOS install tutorial: `/?install=1&platform=ios`
- On iPhone: Safari → Share → Add to Home Screen

### Website (full stack)

Frontend routes live in `src/routes/`. Backend lives on Vercel/Nitro:

- `GET /api/health` — liveness
- `GET /api/status` — stack, PWA flag, feature list
- Auth + PGLite in `src/lib/auth` and `src/lib/db.ts`
- PWA middleware in `server/middleware/grok-pwa.ts`

Ledger data stays in the visitor's browser. The backend serves the site, APIs, auth, and PWA chrome.

## Features

- **Overview** — balance, in/out, cash-flow chart, spending mix, budget pulse, recent activity
- **Calendar** — month grid plus an ANZ-style statement
- **Activity** — searchable ledger grouped by day
- **Budgets** — monthly caps with progress, plus recurring bills
- **Insights** — category mix; click a slice for the entries inside it
- **Reports** — downloadable PDF statement
- **Statement import** — NZ bank CSV / OFX / QIF / ANZ Go PDF
- **Ask Cove** — local assistant in the repo (no xAI API)

## Local development

```bash
npm install
npm run dev
```

Then open `/` (PWA tracker), `/welcome` (website), `/api/status` (backend).

## Stack

React, TanStack Start, Nitro (Vercel), Tailwind, Recharts, Zustand, pdf.js, Better Auth / PGLite.

## Deploy note

The `cove-finance` Vercel project is currently **not Git-linked**. After pushing to GitHub, open the Vercel project → Deployments → Redeploy from `main`, or connect `preet1655nz-rgb/cove-finance` so every push publishes the website, PWA, and API together.
