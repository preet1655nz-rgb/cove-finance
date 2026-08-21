import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { CategoryDonut, FlowChart } from "@/components/charts";
import { PageFrame } from "@/components/page-frame";
import { PeriodSelect } from "@/components/period-select";
import { TransactionRow } from "@/components/transaction-row";
import { Progress } from "@/components/ui/progress";
import { getCategory } from "@/lib/categories";
import { money, pct, signedMoney } from "@/lib/format";
import { needsReconcile } from "@/lib/intelligence";
import { cashBuckets, activeRange, spentInCategory } from "@/lib/period";
import { explainNegativeCash } from "@/lib/cycle";
import { useFinanceStore } from "@/lib/store";
import { endOfMonth, inRange, startOfMonth, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <PageFrame>
      <Dashboard />
    </PageFrame>
  );
}

function Dashboard() {
  const txs = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const period = useFinanceStore((s) => s.period);
  const setPeriod = useFinanceStore((s) => s.setPeriod);
  const cycleMode = useFinanceStore((s) => s.cycleMode);
  const cycleOffset = useFinanceStore((s) => s.cycleOffset);
  const setCycleOffset = useFinanceStore((s) => s.setCycleOffset);
  const name = useFinanceStore((s) => s.settings.displayName);
  const currency = useFinanceStore((s) => s.settings.currency);
  const range = activeRange(txs, period, cycleMode, cycleOffset);
  const slice = txs.filter((t) => inRange(t.date, range.from, range.to));
  const b = cashBuckets(slice);
  const all = cashBuckets(txs);
  const { label } = range;
  const recent = [...txs].sort((a, x) => (a.date < x.date ? 1 : a.date > x.date ? -1 : 0)).slice(0, 6);
  const today = todayISO();
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const budgetRows = budgets
    .map((row) => {
      const spent = spentInCategory(txs, row.categoryId, from, to);
      return { ...row, spent, cat: getCategory(row.categoryId), ratio: row.amount ? spent / row.amount : 0 };
    })
    .sort((a, x) => x.ratio - a.ratio)
    .slice(0, 4);
  const openRec = txs.filter(needsReconcile).length;
  const cashStory = explainNegativeCash(slice, currency);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {name.trim() ? `Good to see you, ${name}` : "A clean start"}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">Overview</h1>
        </div>
        {cycleMode ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-md bg-muted px-3 text-[13px] font-medium"
              onClick={() => setCycleOffset(cycleOffset + 1)}
            >
              Previous cycle
            </button>
            {cycleOffset > 0 ? (
              <button type="button" className="h-9 rounded-md bg-muted px-3 text-[13px] font-medium" onClick={() => setCycleOffset(cycleOffset - 1)}>
                Next
              </button>
            ) : null}
          </div>
        ) : (
          <PeriodSelect value={period} onChange={setPeriod} />
        )}
      </header>

      <section className="rounded-xl bg-card p-6 shadow-card sm:p-8">
        <p className="text-[13px] text-muted-foreground">Cash in this account · {label.toLowerCase()}</p>
        <p className="mt-2 font-display text-5xl tracking-tight tabular-nums sm:text-6xl">
          {signedMoney(b.cash, currency)}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {txs.length
            ? `Income ${money(b.income, currency)} − living ${money(b.expense, currency)} − investing ${money(b.investing, currency)} − savings ${money(b.savings, currency)}${b.credit ? ` − cards ${money(b.credit, currency)}` : ""}${b.debt ? ` − debt ${money(b.debt, currency)}` : ""} = cash movement. Transfers between your accounts are ignored.`
            : "No entries yet. Add one, or upload a statement."}
        </p>
        {cashStory.negative && cashStory.message ? (
          <p className="mt-2 text-sm text-expense">{cashStory.message} Ask Cove if you want it walked through — nothing was edited.</p>
        ) : null}
        {openRec ? (
          <p className="mt-2 text-sm">
            <Link to="/reconcile" className="text-foreground underline-offset-2 hover:underline">
              {openRec} unnamed or uncategorised {openRec === 1 ? "entry needs" : "entries need"} matching
            </Link>
          </p>
        ) : null}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
          <Stat label="Income" value={money(b.income, currency, true)} tone="income" />
          <Stat label="Living" value={money(b.expense, currency, true)} tone="expense" />
          <Stat label="Investing" value={money(b.investing, currency, true)} />
          <Stat label="Savings" value={money(b.savings, currency, true)} />
        </div>
        {b.credit > 0 || b.debt > 0 ? (
          <p className="mt-4 text-[12px] text-muted-foreground">
            {b.credit > 0 ? `Credit card payments ${money(b.credit, currency)}` : ""}
            {b.credit > 0 && b.debt > 0 ? " · " : ""}
            {b.debt > 0 ? `Debt ${money(b.debt, currency)}` : ""}
            {" "}sit outside living spend.
          </p>
        ) : null}
        <p className="mt-3 text-[12px] text-muted-foreground">
          All-time cash movement {signedMoney(all.cash, currency)} (income {money(all.income, currency)}).
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-xl bg-card p-5 shadow-card lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">Income vs living</h2>
            <span className="text-[12px] text-muted-foreground">Six months</span>
          </div>
          <FlowChart txs={txs} currency={currency} />
        </section>
        <section className="rounded-xl bg-card p-5 shadow-card lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Living spend</h2>
            <span className="text-[12px] text-muted-foreground">{label}</span>
          </div>
          <CategoryDonut txs={slice} currency={currency} showAmounts />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">Budgets this month</h2>
            <Link to="/budgets" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              All <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {budgetRows.length ? (
            <ul className="space-y-4">
              {budgetRows.map((row) => (
                <li key={row.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                    <span>{row.cat.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {money(row.spent, currency)} / {money(row.amount, currency)}
                    </span>
                  </div>
                  <Progress
                    value={row.ratio * 100}
                    indicatorClassName={row.ratio >= 1 ? "bg-expense" : row.ratio >= 0.8 ? "bg-chart-5" : "bg-income"}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">{pct(row.ratio * 100)} used</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">No budgets yet.</p>
          )}
        </section>
        <section className="rounded-xl bg-card p-5 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent</h2>
            <Link to="/activity" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              Activity <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {recent.length ? (
            recent.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          ) : (
            <p className="py-8 text-sm text-muted-foreground">Add your first entry with the Add button, or press N.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={
          tone === "income"
            ? "mt-1 text-lg font-medium tabular-nums text-income sm:text-xl"
            : tone === "expense"
              ? "mt-1 text-lg font-medium tabular-nums text-expense sm:text-xl"
              : "mt-1 text-lg font-medium tabular-nums sm:text-xl"
        }
      >
        {value}
      </p>
    </div>
  );
}
