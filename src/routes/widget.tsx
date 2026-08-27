import { createFileRoute, Link } from "@tanstack/react-router";
import { PageFrame } from "@/components/page-frame";
import { money, signedMoney } from "@/lib/format";
import { cashBuckets } from "@/lib/period";
import { useFinanceStore } from "@/lib/store";
import { endOfMonth, inRange, startOfMonth, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/widget")({ component: WidgetPage });

function WidgetPage() {
  return (
    <PageFrame>
      <WidgetBoard />
    </PageFrame>
  );
}

function WidgetBoard() {
  const txs = useFinanceStore((s) => s.transactions);
  const bills = useFinanceStore((s) => s.bills);
  const budgets = useFinanceStore((s) => s.budgets);
  const currency = useFinanceStore((s) => s.settings.currency);
  const today = todayISO();
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const slice = txs.filter((t) => inRange(t.date, from, to));
  const b = cashBuckets(slice);
  const due = bills.filter((bill) => bill.enabled).sort((a, c) => a.dayOfMonth - c.dayOfMonth).slice(0, 4);
  const hot = budgets
    .map((row) => {
      const spent = txs.filter((t) => t.type === "expense" && t.categoryId === row.categoryId && inRange(t.date, from, to)).reduce((s, t) => s + t.amount, 0);
      return { ...row, spent };
    })
    .sort((a, c) => c.spent / Math.max(c.amount, 1) - a.spent / Math.max(a.amount, 1))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[13px] text-muted-foreground">This month</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Cove glance</h1>
      </header>
      <section className="rounded-xl bg-card p-5 shadow-card">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Cash movement</p>
        <p className="mt-1 font-display text-4xl tabular-nums">{signedMoney(b.cash, currency)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          In {money(b.income, currency)} · living {money(b.expense, currency)}
        </p>
      </section>
      <section className="rounded-xl bg-card p-5 shadow-card">
        <h2 className="text-sm font-medium">Upcoming bills</h2>
        {due.length ? (
          <ul className="mt-3 space-y-2">
            {due.map((bill) => (
              <li key={bill.id} className="flex items-baseline justify-between text-sm">
                <span>{bill.name} · {bill.dayOfMonth}th</span>
                <span className="tabular-nums">{money(bill.amount, currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No bills set.</p>
        )}
      </section>
      <section className="rounded-xl bg-card p-5 shadow-card">
        <h2 className="text-sm font-medium">Budgets</h2>
        {hot.length ? (
          <ul className="mt-3 space-y-2">
            {hot.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between text-sm">
                <span>{row.categoryId}</span>
                <span className="tabular-nums text-muted-foreground">
                  {money(row.spent, currency)} / {money(row.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No budgets yet.</p>
        )}
      </section>
      <p className="text-[12px] text-muted-foreground">
        iPhone cannot pin a live WidgetKit tile from a web app. Add this page to the Home Screen from Safari Share → Add to Home Screen for a one-tap glance.{" "}
        <Link to="/" className="underline-offset-4 hover:underline">Back to Overview</Link>
      </p>
    </div>
  );
}
