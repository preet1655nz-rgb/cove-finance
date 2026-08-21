import { createFileRoute } from "@tanstack/react-router";
import { BudgetBars, CategoryDonut, FlowChart } from "@/components/charts";
import { PageFrame } from "@/components/page-frame";
import { PeriodSelect } from "@/components/period-select";
import { Button } from "@/components/ui/button";
import { getCategory } from "@/lib/categories";
import { money } from "@/lib/format";
import { isTransferTx, livingTxs, payeeBreakdown, transferFlows } from "@/lib/intelligence";
import { cashBuckets, inPeriod, periodRange, spentInCategory } from "@/lib/period";
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
  const accounts = useFinanceStore((s) => s.accounts);
  const period = useFinanceStore((s) => s.period);
  const setPeriod = useFinanceStore((s) => s.setPeriod);
  const setImportOpen = useFinanceStore((s) => s.setImportOpen);
  const setChatOpen = useFinanceStore((s) => s.setChatOpen);
  const currency = useFinanceStore((s) => s.settings.currency);
  const slice = txs.filter((t) => inPeriod(t, period));
  const lived = livingTxs(slice);
  const { label, from, to } = periodRange(period);
  const buckets = cashBuckets(slice);
  const moved = slice.filter((t) => t.type === "expense" && isTransferTx(t)).reduce((s, t) => s + t.amount, 0);
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
  const today = todayISO();
  const bars = budgets.map((b) => ({
    name: getCategory(b.categoryId).name,
    spent: spentInCategory(txs, b.categoryId, startOfMonth(today), endOfMonth(today)),
    budget: b.amount,
  }));
  const flows = transferFlows(slice);
  const otherPayees = payeeBreakdown(
    lived.filter((t) => t.categoryId === "other" || t.categoryId === "other-income"),
  ).slice(0, 6);
  const people = payeeBreakdown(lived).slice(0, 8);

  const cards = [
    {
      title: "Income",
      body: money(buckets.income, currency, true),
      hint: `${label} · not transfers`,
    },
    {
      title: "Living",
      body: money(buckets.expense, currency, true),
      hint: `${money(buckets.expense / days, currency)} / day`,
    },
    {
      title: "Investing",
      body: money(buckets.investing, currency, true),
      hint: "Sharesies and the like",
    },
    {
      title: "Savings",
      body: money(buckets.savings, currency, true),
      hint: buckets.income ? `${Math.round((buckets.savings / buckets.income) * 100)}% of income` : "Kept separate from living",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">Where money actually went</p>
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Linked accounts</h2>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Link statement
          </Button>
        </div>
        {accounts.length ? (
          <ul className="divide-y divide-border/70">
            {accounts.map((a) => {
              const list = txs.filter((t) => t.accountId === a.id);
              const bal = list.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
              return (
                <li key={a.id} className="flex items-baseline justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {a.bank !== "other" ? a.bank.toUpperCase() : "Account"} · {list.length} entries
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">{money(bal, currency, true)}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Upload statements from each bank and I’ll keep them as separate pots — transfers from A to B
            show as out on A and in on B, without counting as spending.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-card p-5 shadow-card">
        <h2 className="mb-1 text-sm font-medium">Moved between accounts · {label}</h2>
        <p className="mb-4 text-[12px] text-muted-foreground">
          {moved ? `${money(moved, currency)} left an account as a transfer, not a purchase.` : "No internal transfers in this period."}
        </p>
        {flows.length ? (
          <ul className="space-y-3">
            {flows.map((f) => (
              <li key={`${f.from}-${f.to}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  To {f.to}
                  <span className="text-muted-foreground"> · {f.count}</span>
                </span>
                <span className="tabular-nums">{money(f.amount, currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setChatOpen(true)}>
            Teach Cove a transfer rule
          </button>
        )}
      </section>

      <section className="rounded-xl bg-card p-5 shadow-card">
        <h2 className="mb-4 text-sm font-medium">Lived income and spending</h2>
        <FlowChart txs={livingTxs(txs)} currency={currency} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-2 text-sm font-medium">Where it went · {label}</h2>
          <CategoryDonut txs={lived} currency={currency} />
        </section>
        <section className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-2 text-sm font-medium">Payees · {label}</h2>
          {people.length ? (
            <ul className="space-y-3">
              {people.map((p) => (
                <li key={p.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums text-muted-foreground">{money(p.amount, currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">Import a statement to see named payees instead of a generic Other bucket.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-2 text-sm font-medium">Inside Other</h2>
          {otherPayees.length ? (
            <ul className="space-y-3">
              {otherPayees.map((p) => (
                <li key={p.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums">{money(p.amount, currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">Nothing unnamed. Ask Cove to retag anything that lands here.</p>
          )}
        </section>
        <section className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-2 text-sm font-medium">Budget vs spent</h2>
          <BudgetBars rows={bars} currency={currency} />
        </section>
      </div>
    </div>
  );
}
