import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageFrame } from "@/components/page-frame";
import { PeriodSelect } from "@/components/period-select";
import { TransactionRow } from "@/components/transaction-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCategory } from "@/lib/categories";
import { formatDayLong, money } from "@/lib/format";
import { inPeriod, sumBy } from "@/lib/period";
import { useFinanceStore } from "@/lib/store";
import type { TxType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activity")({ component: ActivityPage });

function ActivityPage() {
  return (
    <PageFrame>
      <Activity />
    </PageFrame>
  );
}

function Activity() {
  const txs = useFinanceStore((s) => s.transactions);
  const period = useFinanceStore((s) => s.period);
  const setPeriod = useFinanceStore((s) => s.setPeriod);
  const setAddOpen = useFinanceStore((s) => s.setAddOpen);
  const setImportOpen = useFinanceStore((s) => s.setImportOpen);
  const currency = useFinanceStore((s) => s.settings.currency);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | TxType>("all");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...txs]
      .filter((t) => inPeriod(t, period))
      .filter((t) => (kind === "all" ? true : t.type === kind))
      .filter((t) => {
        if (!needle) return true;
        const cat = getCategory(t.categoryId).name.toLowerCase();
        return t.note.toLowerCase().includes(needle) || cat.includes(needle);
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [txs, period, q, kind]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const t of list) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()];
  }, [list]);

  const income = sumBy(list, "income");
  const expense = sumBy(list, "expense");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">Every in and out</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Activity</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Statement
          </Button>
          <Button onClick={() => setAddOpen(true)}>Add</Button>
        </div>
      </header>

      <PeriodSelect value={period} onChange={setPeriod} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes or categories"
          className="sm:max-w-xs"
        />
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["all", "expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "h-9 rounded-md px-3 text-[13px] font-medium capitalize",
                kind === k ? "bg-card shadow-card" : "text-muted-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {list.length} entries · {money(income, currency)} in · {money(expense, currency)} out
      </p>

      <div className="rounded-xl bg-card p-3 shadow-card sm:p-4">
        {groups.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Nothing matches. Try another period or add an entry.</p>
        ) : (
          groups.map(([date, rows]) => (
            <section key={date} className="mb-4 last:mb-0">
              <h2 className="px-2 py-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                {formatDayLong(date)}
              </h2>
              {rows.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
