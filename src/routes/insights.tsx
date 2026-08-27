import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BudgetBars, CategoryDonut, FlowChart } from "@/components/charts";
import { PageFrame } from "@/components/page-frame";
import { PeriodSelect } from "@/components/period-select";
import { Button } from "@/components/ui/button";
import { getCategory } from "@/lib/categories";
import { buildCycleReview, formatGrokCopy } from "@/lib/cycle-review";
import { downloadCycleReviewPdf } from "@/lib/cycle-review-pdf";
import { money, signedMoney } from "@/lib/format";
import { isTransferTx, livingTxs, payeeBreakdown, transferFlows } from "@/lib/intelligence";
import { activeRange, cashBuckets, spentInCategory } from "@/lib/period";
import { useFinanceStore } from "@/lib/store";
import { cn, endOfMonth, inRange, startOfMonth, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/insights")({ component: InsightsPage });

function InsightsPage() {
  return (
    <PageFrame>
      <Insights />
    </PageFrame>
  );
}

function pctOf(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}% of income`;
}

function Insights() {
  const txs = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const period = useFinanceStore((s) => s.period);
  const setPeriod = useFinanceStore((s) => s.setPeriod);
  const cycleMode = useFinanceStore((s) => s.cycleMode);
  const cycleOffset = useFinanceStore((s) => s.cycleOffset);
  const currency = useFinanceStore((s) => s.settings.currency);
  const customFrom = useFinanceStore((s) => s.settings.customFrom);
  const customTo = useFinanceStore((s) => s.settings.customTo);
  const range = activeRange(txs, period, cycleMode, cycleOffset, { from: customFrom, to: customTo });
  const slice = txs.filter((t) => inRange(t.date, range.from, range.to));
  const lived = livingTxs(slice);
  const { label, from, to } = range;
  const buckets = cashBuckets(slice);
  const [flow, setFlow] = useState<"expense" | "income">("expense");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
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
  const donutTxs = flow === "expense" ? slice.filter((t) => t.type === "expense" && !isTransferTx(t)) : lived;

  const categoryBreakdown = useMemo(() => {
    if (!selectedCategoryId) return [];
    return donutTxs
      .filter((t) => {
        const id = t.categoryId === "credit-card" ? "debt" : t.categoryId;
        return id === selectedCategoryId && t.type === flow;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 40);
  }, [donutTxs, selectedCategoryId, flow]);

  const categoryTotal = categoryBreakdown.reduce((s, t) => s + t.amount, 0);
  const debtPaid = buckets.debt + buckets.credit;
  const variance = buckets.variance;
  const review = useMemo(
    () => buildCycleReview({ txs, budgets, currency, from, to, label }),
    [txs, budgets, currency, from, to, label],
  );
  const [pdfBusy, setPdfBusy] = useState(false);

  async function onCopyGrok() {
    try {
      await navigator.clipboard.writeText(formatGrokCopy(review));
      toast.success("Insights copied for Grok");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function onPdf() {
    setPdfBusy(true);
    try {
      await downloadCycleReviewPdf(review);
      toast.success("Cycle PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  const cards = [
    { title: "Income", body: money(buckets.income, currency, true), hint: `${label} · not transfers` },
    { title: "Debt", body: money(debtPaid, currency, true), hint: `${pctOf(debtPaid, buckets.income)} · cards + loans` },
    { title: "Living", body: money(buckets.expense, currency, true), hint: `${pctOf(buckets.expense, buckets.income)} · ${money(buckets.expense / days, currency)} / day` },
    { title: "Investing", body: money(buckets.investing, currency, true), hint: pctOf(buckets.investing, buckets.income) },
    { title: "Savings", body: money(buckets.savings, currency, true), hint: pctOf(buckets.savings, buckets.income) },
  ];

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">Where money actually went</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Insights</h1>
        </div>
        {cycleMode ? <p className="text-[13px] text-muted-foreground">{label}</p> : <PeriodSelect value={period} onChange={setPeriod} />}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <article key={c.title} className="min-w-0 overflow-hidden rounded-xl bg-card p-4 shadow-card sm:p-5">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{c.title}</p>
            <p className="mt-2 truncate font-display text-xl tabular-nums sm:text-2xl">{c.body}</p>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{c.hint}</p>
          </article>
        ))}
      </div>

      <section className="min-w-0 rounded-xl bg-card p-5 shadow-card">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Variance</p>
        <p className="mt-2 font-display text-3xl tabular-nums">{signedMoney(variance, currency)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {money(buckets.income, currency)} income − {money(buckets.expense, currency)} living − {money(debtPaid, currency)} debt − {money(buckets.savings, currency)} savings − {money(buckets.investing, currency)} investing
        </p>
      </section>

      <section className="min-w-0 rounded-xl bg-card p-5 shadow-card">
        <h2 className="mb-1 text-sm font-medium">Moved between accounts · {label}</h2>
        <p className="mb-4 text-[12px] text-muted-foreground">
          {moved ? `${money(moved, currency)} left an account as a transfer, not a purchase.` : "No internal transfers in this period."}
        </p>
        {flows.length ? (
          <ul className="space-y-3">
            {flows.map((f) => (
              <li key={`${f.from}-${f.to}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">To {f.to}<span className="text-muted-foreground"> · {f.count}</span></span>
                <span className="shrink-0 tabular-nums">{money(f.amount, currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No internal transfers tagged in this window.</p>
        )}
      </section>

      <section className="min-w-0 rounded-xl bg-card p-5 shadow-card">
        <h2 className="mb-4 text-sm font-medium">Lived income and spending</h2>
        <FlowChart txs={livingTxs(txs)} currency={currency} />
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="min-w-0 text-sm font-medium">{flow === "income" ? "Income breakdown" : "Where it went"} · {label}</h2>
            <div className="flex shrink-0 rounded-lg bg-muted p-0.5">
              {(["expense", "income"] as const).map((k) => (
                <button key={k} type="button" onClick={() => { setFlow(k); setSelectedCategoryId(null); }} className={cn("h-8 rounded-md px-2.5 text-[12px] font-medium capitalize", flow === k ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}>
                  {k === "expense" ? "Spending" : "Income"}
                </button>
              ))}
            </div>
          </div>
          <CategoryDonut txs={donutTxs} currency={currency} kind={flow} showAmounts selectedId={selectedCategoryId} onSelect={setSelectedCategoryId} includeAllocations />
          {selectedCategoryId ? (
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-medium">{getCategory(selectedCategoryId).name} breakdown</h3>
                <p className="text-[12px] tabular-nums text-muted-foreground">{categoryBreakdown.length} entries · {money(categoryTotal, currency)}</p>
              </div>
              {categoryBreakdown.length ? (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {categoryBreakdown.map((t) => (
                    <li key={t.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate"><span className="text-muted-foreground">{t.date}</span>{" · "}{t.note || getCategory(t.categoryId).name}</span>
                      <span className="shrink-0 tabular-nums">{money(t.amount, currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No entries in this slice for the selected period.</p>
              )}
              <button type="button" className="mt-3 text-[12px] text-muted-foreground underline-offset-4 hover:underline" onClick={() => setSelectedCategoryId(null)}>Clear selection</button>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-muted-foreground">Tap a slice or label to see every entry in that category.</p>
          )}
        </section>
        <section className="min-w-0 rounded-xl bg-card p-5 shadow-card">
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl bg-card p-5 shadow-card">
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
            <p className="py-8 text-sm text-muted-foreground">Nothing unnamed. Retag Other rows from Activity if they pile up.</p>
          )}
        </section>
        <section className="min-w-0 rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-2 text-sm font-medium">Budget vs spent</h2>
          <BudgetBars rows={bars} currency={currency} />
        </section>
      </div>

      <section className="min-w-0 rounded-xl bg-card p-5 shadow-card">
        <h2 className="text-sm font-medium">Cycle pack</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">Follows the period or pay cycle selected above. Numbers only — no account details.</p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{review.scoreLine}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Patterns</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-relaxed">{review.patterns.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
          <div>
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Budgeting</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-relaxed">{review.suggestions.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
          <div>
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Watch-outs</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-relaxed">{review.watchouts.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => void onPdf()} disabled={pdfBusy} className="w-full sm:w-auto">{pdfBusy ? "Building PDF…" : "Download cycle PDF"}</Button>
          <Button type="button" variant="outline" onClick={() => void onCopyGrok()} className="w-full sm:w-auto">Copy Insights for Grok</Button>
        </div>
      </section>
    </div>
  );
}
