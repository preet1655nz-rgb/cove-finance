import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  FileText,
  LayoutGrid,
  MessageCircle,
  PieChart,
  Receipt,
  Shield,
  Upload,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/welcome")({
  component: WelcomeSite,
  head: () => ({
    meta: [
      { title: "Cove — Quiet money tracker" },
      {
        name: "description",
        content:
          "Cove is a free website for tracking income, living spend, budgets, bills and reports. Ask Cove finds transactions. Data stays in your browser.",
      },
    ],
  }),
});

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Overview",
    body: "Cash movement, income vs living, and a living-spend chart you can click for a transaction breakdown.",
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    body: "Month grid plus an ANZ-style statement with running balance.",
  },
  {
    icon: Receipt,
    title: "Activity",
    body: "Searchable ledger grouped by day. Add, edit, or import.",
  },
  {
    icon: Wallet,
    title: "Budgets & bills",
    body: "Monthly caps with progress, plus bills that surface before they are due.",
  },
  {
    icon: PieChart,
    title: "Insights",
    body: "Category mix, payees, transfers between accounts. Click a slice to see every entry inside it.",
  },
  {
    icon: FileText,
    title: "Reports",
    body: "Download a monthly PDF statement from the same books.",
  },
  {
    icon: Upload,
    title: "Statement import",
    body: "Drop NZ bank CSV, OFX, QIF or ANZ Go PDF. Review before it hits the ledger.",
  },
  {
    icon: MessageCircle,
    title: "Ask Cove",
    body: "Local assistant that reads your books, finds payees like Airbnb, and asks when something is unclear.",
  },
];

function WelcomeSite() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/welcome" className="flex items-center gap-2.5">
            <span className="flex size-8 overflow-hidden rounded-sm bg-foreground" aria-hidden>
              <img src="/cove-mark.png" alt="" className="size-8 object-cover" width={32} height={32} />
            </span>
            <span className="font-display text-xl tracking-tight">Cove</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#privacy" className="hover:text-foreground">
              Privacy
            </a>
          </nav>
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Cove
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div>
            <p className="text-[13px] tracking-wide text-muted-foreground uppercase">Website · same books as the app</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              A quiet harbor for income, spending, and reports.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Cove is a full website, not just a phone home-screen tile. Use it in any browser. Add entries, import
              statements, click the living-spend chart for a breakdown, and ask Cove to find a transaction.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open the tracker
              </Link>
              <Link
                to="/insights"
                className="inline-flex h-11 items-center rounded-md bg-muted px-5 text-sm font-medium hover:bg-accent"
              >
                Insights
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground">Free · stays in this browser · shareable Vercel URL</p>
          </div>

          <div className="rounded-2xl bg-card p-5 shadow-card sm:p-6">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">On the website</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <LayoutGrid className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                Overview cash, income, living, investing, savings
              </li>
              <li className="flex gap-3">
                <PieChart className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                Click Utilities (or any slice) for the entries inside it
              </li>
              <li className="flex gap-3">
                <MessageCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                Ask Cove: “find airbnb”, add a bill, set a budget
              </li>
              <li className="flex gap-3">
                <Bell className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                Notices for caps and bills coming due
              </li>
              <li className="flex gap-3">
                <Shield className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                Nothing leaves the device unless you export it
              </li>
            </ul>
          </div>
        </section>

        <section id="features" className="border-t border-border/70 bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <p className="text-[13px] text-muted-foreground">Same functions as the app</p>
            <h2 className="mt-2 font-display text-3xl tracking-tight">Everything lives on the website</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <article key={f.title} className="rounded-xl bg-card p-5 shadow-card">
                    <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
                    <h3 className="mt-3 text-sm font-medium">{f.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="font-display text-3xl tracking-tight">How to use it as a website</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            <li className="rounded-xl bg-card p-5 shadow-card">
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">01</p>
              <p className="mt-2 text-sm font-medium">Open cove-finance.vercel.app</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Works in Safari, Chrome, Edge, and Firefox. No App Store. Phone, tablet, or desktop.
              </p>
            </li>
            <li className="rounded-xl bg-card p-5 shadow-card">
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">02</p>
              <p className="mt-2 text-sm font-medium">Add or import</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Press Add (or N on a keyboard), or upload a bank statement. Books stay in this browser.
              </p>
            </li>
            <li className="rounded-xl bg-card p-5 shadow-card">
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">03</p>
              <p className="mt-2 text-sm font-medium">Read the books</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Click a chart slice for the list underneath. Ask Cove to find a payee instead of a generic summary.
              </p>
            </li>
          </ol>
        </section>

        <section id="privacy" className="border-t border-border/70">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 sm:flex-row sm:items-end sm:justify-between sm:py-16">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl tracking-tight">Local by design</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Ask Cove runs from code in this repo. No xAI or Grok API. Share the Vercel URL and each visitor keeps
                their own ledger in their own browser.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open Cove
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Cove · Quiet money</p>
          <p>Website and app share the same functions and the same GitHub repo.</p>
        </div>
      </footer>
    </div>
  );
}
