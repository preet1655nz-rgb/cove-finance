import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { categoriesFor, getCategory } from "@/lib/categories";
import { money } from "@/lib/format";
import { needsReconcile } from "@/lib/intelligence";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reconcile")({ component: ReconcilePage });

function ReconcilePage() {
  return (
    <PageFrame>
      <Reconcile />
    </PageFrame>
  );
}

function Reconcile() {
  const txs = useFinanceStore((s) => s.transactions);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const currency = useFinanceStore((s) => s.settings.currency);
  const [filter, setFilter] = useState<"open" | "unnamed" | "other">("open");

  const open = useMemo(() => txs.filter(needsReconcile).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [txs]);
  const unnamed = open.filter((t) => !t.note.trim());
  const other = open.filter((t) => t.categoryId === "other" || t.categoryId === "other-income");
  const list = filter === "unnamed" ? unnamed : filter === "other" ? other : open;
  const done = txs.length - open.length;

  function match(id: string, categoryId: string) {
    const cat = getCategory(categoryId);
    updateTransaction(id, { categoryId, type: cat.type, reviewed: true });
  }

  function accept(id: string) {
    updateTransaction(id, { reviewed: true });
    toast.success("Matched");
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[13px] text-muted-foreground">Xero-style matching. Name it, pick a category, tick it off.</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Reconcile</h1>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Mini label="To match" value={String(open.length)} />
        <Mini label="Unnamed" value={String(unnamed.length)} />
        <Mini label="Matched" value={String(Math.max(0, done))} />
      </section>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["open", "All open"],
            ["unnamed", "Unnamed"],
            ["other", "Uncategorised"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "h-9 flex-1 rounded-md px-3 text-[13px] font-medium",
              filter === id ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl bg-card px-5 py-12 text-center text-sm text-muted-foreground shadow-card">
          {txs.length ? "Everything in the ledger has a name and a category." : "Upload a statement, then match anything Cove could not name."}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((tx) => {
            const cats = categoriesFor(tx.type).filter((c) => c.id !== "transfer-in" && c.id !== "transfer-out");
            return (
              <li key={tx.id} className="rounded-xl bg-card p-4 shadow-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tx.note.trim() || "No description"}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {tx.date} · {tx.type === "income" ? "In" : "Out"} · {getCategory(tx.categoryId).name}
                    </p>
                  </div>
                  <p className={cn("text-sm font-medium tabular-nums", tx.type === "income" ? "text-income" : "")}>
                    {tx.type === "income" ? "+" : "−"}
                    {money(tx.amount, currency)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cats.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => match(tx.id, c.id)}
                      className={cn(
                        "h-8 rounded-md px-2.5 text-[12px] font-medium",
                        tx.categoryId === c.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => accept(tx.id)}>
                    Looks right
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}
