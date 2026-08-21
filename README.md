# Cove

A quiet income and expense tracker. Add money in seconds, watch cash flow, set budgets, import a bank PDF, and export a monthly statement.

## Features

- **Overview** — balance, in/out, cash-flow chart, spending mix, budget pulse, recent activity
- **Calendar** — month grid plus an ANZ-style statement (date, type and details, withdrawals, deposits, running balance)
- **Activity** — searchable, filterable ledger grouped by day
- **Budgets** — monthly caps with progress, plus recurring bills
- **Insights** — daily spend, savings rate, category mix, budget vs spent
- **Reports** — month picker and downloadable PDF statement
- **Statement import** — drop an ANZ Go PDF (or CSV / OFX / QIF). Direct credits become income, withdrawals become expenses. Review before import.
- **Notices** — budget caps, bills due in the next few days, spending hints
- **Settings** — currency, browser notifications, JSON backup, sample data

All figures stay on this device (browser storage). Nothing is sent to a server.

## Try an ANZ statement

Calendar → **Statement** → drop your bank PDF, or **Try ANZ PDF**. Cove was checked against a real Go page:

- Deposits **$6,919.71** (IRD wages, Uber, DiDi)
- Withdrawals **$6,888.99**
- 47 entries, opening balance skipped

## Keyboard

- `N` — new entry

## Local development

```bash
npm install
npm run dev
```

## Stack

React, TanStack Start, Tailwind, Recharts, Zustand, pdf.js.

## Links

- Source: [github.com/preet1655nz-rgb/cove-finance](https://github.com/preet1655nz-rgb/cove-finance)
- Deploy: import that repo in Vercel ([vercel.com/new](https://vercel.com/new/import?s=https://github.com/preet1655nz-rgb/cove-finance))
