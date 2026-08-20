import { createFileRoute } from "@tanstack/react-router";
import { BudgetBars, CategoryDonut, FlowChart } from "@/components/charts";
import { PageFrame } from "@/components/page-frame";
import { PeriodSelect } from "@/components/period-select";
import { getCategory } from "@/lib/categories";
import { money } from "@/lib/format";
import { inPeriod, monthlySeries, periodRange, spentInCategory, sumBy } from "@/lib/period";
import { useFinanceStore } from "@/lib/store";
import { endOfMonth, startOfMonth, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/insights")({ component: InsightsPage });

function InsightsPage() {
  return (
    <PageFrame>
      <Insights />
    </PageFrame>
  );
}

function Insights() {
  const txs = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const period = useFinanceStore((s) => s.period);
  const setPeriod = useFinanceStore((s) => s.setPeriod);
  const currency = useFinanceStore((s) => s.settings.currency);
  const slice = txs.filter((t) => inPeriod(t, period));
  const { label, from, to } = periodRange(period);
  const income = sumBy(txs, "income", period);
  const expense = sumBy(txs, "expense", period);
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
  const series = monthlySeries(txs, 6);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const delta = prev ? last.expense - prev.expense : 0;
  const today = todayISO();
  const bars = budgets.map((b) => ({
    name: getCategory(b.categoryId).name,
    spent: spentInCategory(txs, b.categoryId, startOfMonth(today), endOfMonth(today)),
    budget: b.amount,
  }));
  const top = [...slice.filter((t) => t.type === "expense")]
    .reduce<Map<string, number>>((m, t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount), new Map());
  const topCat = [...top.entries()].sort((a, b) => b[1] - a[1])[0];

  const cards = [
    {
      title: "Daily spend",
      body: money(expense / days, currency),
      hint: `Averaged across ${label.toLowerCase()}`,
    },
    {
      title: "Savings rate",
      body: income ? `${Math.round(((income - expense) / income) * 100)}%` : "—",
      hint: "Share of income kept",
    },
    {
      title: "Vs last month",
      body: prev ? `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta), currency)}` : "—",
      hint: "Change in spending",
    },
    {
      title: "Largest slice",
      body: topCat ? getCategory(topCat[0]).name : "—",
      hint: topCat ? money(topCat[1], currency) : "No expenses yet",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">Patterns, not noise</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Insights</h1>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <article key={c.title} className="rounded-xl bg-card p-5 shadow-card">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{c.title}</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{c.body}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{c.hint}</p>
          </article>
        ))}
      </div>

      <section className="rounded-xl bg-card p-5 shadow-card">
        <h2 className="mb-4 text-sm font-medium">Income and spending</h2>
        <FlowChart txs={txs} currency={currency} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-2 text-sm font-medium">Where it went · {label}</h2>
          <CategoryDonut txs={slice} currency={currency} />
        </section>
        <section className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-2 text-sm font-medium">Budget vs spent</h2>
          <BudgetBars rows={bars} currency={currency} />
        </section>
      </div>
    </div>
  );
}
