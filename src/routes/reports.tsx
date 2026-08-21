import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCategory } from "@/lib/categories";
import { formatMonth, money } from "@/lib/format";
import { downloadMonthlyPdf } from "@/lib/pdf";
import { monthlySeries, spentInCategory, cashBuckets } from "@/lib/period";
import { useFinanceStore } from "@/lib/store";
import { endOfMonth, inRange, monthKey, startOfMonth, todayISO } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  return (
    <PageFrame>
      <Reports />
    </PageFrame>
  );
}

function Reports() {
  const txs = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const currency = useFinanceStore((s) => s.settings.currency);
  const name = useFinanceStore((s) => s.settings.displayName);
  const months = useMemo(() => {
    const keys = new Set(txs.map((t) => monthKey(t.date)));
    keys.add(monthKey(todayISO()));
    return [...keys].sort().reverse();
  }, [txs]);
  const [month, setMonth] = useState(months[0] ?? monthKey(todayISO()));
  const [busy, setBusy] = useState(false);

  const from = startOfMonth(`${month}-01`);
  const to = endOfMonth(from);
  const slice = txs.filter((t) => inRange(t.date, from, to));
  const buckets = cashBuckets(slice);
  const byCat = [...slice.filter((t) => t.type === "expense" && t.categoryId !== "transfer-out")].reduce<Map<string, number>>((m, t) => {
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
    return m;
  }, new Map());
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const trend = monthlySeries(txs, 6);

  async function onDownload() {
    setBusy(true);
    try {
      await downloadMonthlyPdf({ month, transactions: txs, budgets, currency, name });
      toast.success("Report downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">A clean statement you can keep</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Reports</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonth(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void onDownload()} disabled={busy}>
            {busy ? "Preparing…" : "Download PDF"}
          </Button>
        </div>
      </header>

      <section className="rounded-xl bg-card p-6 shadow-card">
        <p className="text-[13px] text-muted-foreground">{formatMonth(from)}</p>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Figure label="Income" value={money(buckets.income, currency)} />
          <Figure label="Living" value={money(buckets.expense, currency)} />
          <Figure label="Investing" value={money(buckets.investing, currency)} />
          <Figure label="Savings" value={money(buckets.savings, currency)} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Cash movement {money(buckets.cash, currency)} after living, investing, savings
          {buckets.credit ? ` and card payments ${money(buckets.credit, currency)}` : ""}. Transfers ignored.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-medium">By category</h2>
          {cats.length ? (
            <ul className="space-y-3">
              {cats.map(([id, amt]) => (
                <li key={id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{getCategory(id).name}</span>
                  <span className="tabular-nums text-muted-foreground">{money(amt, currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">No spending this month.</p>
          )}
        </section>
        <section className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-medium">Budgets</h2>
          {budgets.length ? (
            <ul className="space-y-3">
              {budgets.map((b) => {
                const spent = spentInCategory(txs, b.categoryId, from, to);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{getCategory(b.categoryId).name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {money(spent, currency)} / {money(b.amount, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">No budgets set.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl bg-card p-5 shadow-card">
        <h2 className="mb-4 text-sm font-medium">Six-month net</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {trend.map((r) => (
            <li key={r.key} className="rounded-lg bg-muted/60 px-3 py-3">
              <p className="text-[11px] text-muted-foreground">{r.key}</p>
              <p className="mt-1 text-sm font-medium tabular-nums">{money(r.net, currency)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}
