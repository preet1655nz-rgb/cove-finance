import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { CategoryDonut, FlowChart } from "@/components/charts";
import { PageFrame } from "@/components/page-frame";
import { PeriodSelect } from "@/components/period-select";
import { TransactionRow } from "@/components/transaction-row";
import { Progress } from "@/components/ui/progress";
import { getCategory } from "@/lib/categories";
import { money, signedMoney } from "@/lib/format";
import { livingTxs, needsReconcile } from "@/lib/intelligence";
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
  const lived = livingTxs(slice);
  const b = cashBuckets(slice);
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const categoryBreakdown = useMemo(() => {
    if (!selectedCategoryId) return [];
    return lived
      .filter((t) => t.categoryId === selectedCategoryId && t.type === "expense")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 40);
  }, [lived, selectedCategoryId]);

  const categoryTotal = categoryBreakdown.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{name.trim() ? name : "Overview"}</p>
          <p className="mt-2 font-display text-5xl tracking-tight tabular-nums sm:text-6xl">{signedMoney(b.cash, currency)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Cash this period · {label.toLowerCase()}</p>
        </div>
        {cycleMode ? (
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className="h-9 rounded-full bg-muted px-3 text-sm" onClick={() => setCycleOffset(cycleOffset + 1)}>
              Previous
            </button>
            {cycleOffset > 0 ? (
              <button type="button" className="h-9 rounded-full bg-muted px-3 text-sm" onClick={() => setCycleOffset(cycleOffset - 1)}>
                Next
              </button>
            ) : null}
          </div>
        ) : (
          <PeriodSelect value={period} onChange={setPeriod} />
        )}
      </header>

      <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        <Stat label="Income" value={money(b.income, currency, true)} tone="income" />
        <Stat label="Living" value={money(b.expense, currency, true)} tone="expense" />
        <Stat label="Investing" value={money(b.investing, currency, true)} />
        <Stat label="Savings" value={money(b.savings, currency, true)} />
      </section>

      {cashStory.negative && cashStory.message ? <p className="text-sm text-expense">{cashStory.message}</p> : null}
      {openRec ? (
        <p className="-mt-6 text-sm">
          <Link to="/reconcile" className="text-foreground underline-offset-4 hover:underline">
            {openRec} {openRec === 1 ? "entry needs" : "entries need"} a category
          </Link>
        </p>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent</h2>
          <Link to="/activity" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            All <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        {recent.length ? (
          recent.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
        ) : (
          <p className="py-10 text-sm text-muted-foreground">Nothing yet. Add an entry, or upload a statement.</p>
        )}
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-card sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Six months</h2>
          <span className="text-xs text-muted-foreground">Income and living</span>
        </div>
        <FlowChart txs={txs} currency={currency} />
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-card sm:p-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Where living went</h2>
          <span className="truncate text-xs text-muted-foreground">{label}</span>
        </div>
        <CategoryDonut txs={lived} currency={currency} showAmounts selectedId={selectedCategoryId} onSelect={setSelectedCategoryId} />
        {selectedCategoryId ? (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{getCategory(selectedCategoryId).name}</h3>
              <p className="text-xs tabular-nums text-muted-foreground">
                {categoryBreakdown.length} · {money(categoryTotal, currency)}
              </p>
            </div>
            {categoryBreakdown.length ? (
              <ul className="max-h-52 space-y-2 overflow-y-auto">
                {categoryBreakdown.map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">{t.date}</span>
                      {" · "}
                      {t.note || getCategory(t.categoryId).name}
                    </span>
                    <span className="shrink-0 tabular-nums">{money(t.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No entries in this period.</p>
            )}
            <button type="button" className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setSelectedCategoryId(null)}>
              Clear
            </button>
          </div>
        ) : null}
      </section>

      {budgetRows.length ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Budgets</h2>
            <Link to="/budgets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              All <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <ul className="space-y-4">
            {budgetRows.slice(0, 3).map((row) => (
              <li key={row.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span>{row.cat.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(row.spent, currency)} / {money(row.amount, currency)}
                  </span>
                </div>
                <Progress value={row.ratio * 100} indicatorClassName={row.ratio >= 1 ? "bg-expense" : row.ratio >= 0.8 ? "bg-chart-5" : "bg-income"} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "income"
            ? "mt-1 text-lg font-medium tabular-nums text-income"
            : tone === "expense"
              ? "mt-1 text-lg font-medium tabular-nums text-expense"
              : "mt-1 text-lg font-medium tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}
