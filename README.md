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
- `POST /api/accounts` — register / login / Gmail OAuth adopt / forgot / reset
- Auth + PGLite in `src/lib/auth` and `src/lib/db.ts`
- PWA middleware in `server/middleware/grok-pwa.ts`

Ledger data stays in the visitor's browser. Accounts sync through Neon so the same email works on the website and the iPhone home-screen app.

## Features

- **Overview** — balance, in/out, cash-flow chart, spending mix, budget pulse, recent activity
- **Calendar** — month grid plus an ANZ-style statement
- **Activity** — searchable ledger grouped by day
- **Budgets** — monthly caps with progress, plus recurring bills
- **Insights** — category mix including debt; click a slice for the entries inside it
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

React, TanStack Start, Nitro (Vercel), Tailwind, Recharts, Zustand, pdf.js, Better Auth / PGLite, Neon, Resend.

## Deploy

Vercel project `cove-finance` is Git-linked to `preet1655nz-rgb/cove-finance` on branch `main`. Every push to `main` publishes the website, PWA, and API together.

### Env for Gmail reset links

Resend can be authorised against this GitHub repo. Vercel still needs the API key as an env var:

1. Resend → API Keys → copy `re_...`
2. Vercel → cove-finance → Settings → Environment Variables → add for Production + Preview:
   - `DATABASE_URL` — Neon Postgres (accounts + ledger vault)
   - `RESEND_API_KEY` — the Resend key
   - `EMAIL_FROM` — verified Resend sender, e.g. `Cove <you@yourdomain>`
3. Redeploy after saving env vars.

Until a domain is verified in Resend, Cove falls back to `Cove <beth.t@example.com>`. That address only delivers into the Resend dashboard inbox, not a real Gmail inbox. Verify a domain in Resend to land reset links in Gmail.
