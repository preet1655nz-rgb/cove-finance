import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CategoryPicker } from "@/components/category-picker";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { categoriesFor, getCategory, slugCategoryId } from "@/lib/categories";
import { money } from "@/lib/format";
import { merchantKey, needsReconcile } from "@/lib/intelligence";
import { looseFingerprint } from "@/lib/statement";
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
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);
  const upsertCustomCategory = useFinanceStore((s) => s.upsertCustomCategory);
  const rememberCategory = useFinanceStore((s) => s.rememberCategory);
  const currency = useFinanceStore((s) => s.settings.currency);
  const [filter, setFilter] = useState<"open" | "unnamed" | "other" | "dupes">("open");

  const dupes = useMemo(() => {
    const seen = new Map<string, string>();
    const ids = new Set<string>();
    const ordered = [...txs].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const tx of ordered) {
      const key = looseFingerprint(tx.date, tx.amount, tx.note);
      if (!key) continue;
      const first = seen.get(key);
      if (first) ids.add(tx.id);
      else seen.set(key, tx.id);
    }
    return ids;
  }, [txs]);

  const open = useMemo(() => txs.filter(needsReconcile).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [txs]);
  const unnamed = open.filter((t) => !t.note.trim());
  const other = open.filter((t) => t.categoryId === "other" || t.categoryId === "other-income");
  const dupeRows = txs.filter((t) => dupes.has(t.id));
  const list = filter === "unnamed" ? unnamed : filter === "other" ? other : filter === "dupes" ? dupeRows : open;
  const done = txs.length - open.length;

  function match(id: string, categoryId: string, note: string) {
    const cat = getCategory(categoryId);
    updateTransaction(id, { categoryId, type: cat.type, reviewed: true });
    rememberCategory(merchantKey(note) || note, categoryId);
    toast.success("Matched");
  }

  function accept(id: string) {
    updateTransaction(id, { reviewed: true });
    toast.success("Matched");
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[13px] text-muted-foreground">Match each line once. A shop already in the books stays out of the next import.</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Reconcile</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="To match" value={String(open.length)} />
        <Mini label="Unnamed" value={String(unnamed.length)} />
        <Mini label="Possible doubles" value={String(dupeRows.length)} />
        <Mini label="Matched" value={String(Math.max(0, done))} />
      </section>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["open", "All open"],
            ["unnamed", "Unnamed"],
            ["other", "Uncategorised"],
            ["dupes", "Doubles"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "h-9 flex-1 rounded-md px-2 text-[12px] font-medium sm:text-[13px]",
              filter === id ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl bg-card px-5 py-12 text-center text-sm text-muted-foreground shadow-card">
          {txs.length ? "Nothing in this list. New statement rows that match a date, amount and shop are left out." : "Upload a statement, then match anything Cove could not name."}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((tx) => {
            const cats = categoriesFor(tx.type).filter((c) => c.id !== "transfer-in" && c.id !== "transfer-out");
            const doubled = dupes.has(tx.id);
            return (
              <li key={tx.id} className="rounded-xl bg-card p-4 shadow-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tx.note.trim() || "No description"}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {tx.date} · {tx.type === "income" ? "In" : "Out"} · {getCategory(tx.categoryId).name}
                      {doubled ? " · same shop, date and amount already in the books" : ""}
                    </p>
                  </div>
                  <p className={cn("text-sm font-medium tabular-nums", tx.type === "income" ? "text-income" : "")}>
                    {tx.type === "income" ? "+" : "−"}
                    {money(tx.amount, currency)}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <CategoryPicker
                    value={tx.categoryId}
                    options={cats}
                    onChange={(id) => match(tx.id, id, tx.note)}
                    onCreate={(name) => {
                      if (name.trim().length < 2) return;
                      const id = slugCategoryId(name);
                      upsertCustomCategory({ id, name, type: tx.type });
                      match(tx.id, id, tx.note);
                    }}
                  />
                  <div className="flex gap-2 sm:ml-auto">
                    {doubled ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          removeTransaction(tx.id);
                          toast.success("Duplicate removed");
                        }}
                      >
                        Remove duplicate
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => accept(tx.id)}>
                      Looks right
                    </Button>
                  </div>
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
