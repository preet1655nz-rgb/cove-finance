import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoriesFor, getCategory } from "@/lib/categories";
import { money, pct } from "@/lib/format";
import { spentInCategory } from "@/lib/period";
import { useFinanceStore } from "@/lib/store";
import { endOfMonth, startOfMonth, todayISO } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/budgets")({ component: BudgetsPage });

function BudgetsPage() {
  return (
    <PageFrame>
      <Budgets />
    </PageFrame>
  );
}

function Budgets() {
  const txs = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const upsertBudget = useFinanceStore((s) => s.upsertBudget);
  const removeBudget = useFinanceStore((s) => s.removeBudget);
  const currency = useFinanceStore((s) => s.settings.currency);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("groceries");
  const [amt, setAmt] = useState("500");

  const today = todayISO();
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const rows = budgets
    .map((b) => {
      const spent = spentInCategory(txs, b.categoryId, from, to);
      return { ...b, spent, cat: getCategory(b.categoryId), ratio: b.amount ? spent / b.amount : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio);
  const planned = rows.reduce((s, r) => s + r.amount, 0);
  const used = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">Monthly caps. Bills live on the Bills tab.</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Budgets</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/bills">Bills</Link>
          </Button>
          <Button onClick={() => setOpen(true)}>Add budget</Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Mini label="Planned" value={money(planned, currency, true)} />
        <Mini label="Spent" value={money(used, currency, true)} />
        <Mini label="Left" value={money(Math.max(0, planned - used), currency, true)} className="max-sm:col-span-2" />
      </section>

      <section className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-card px-5 py-12 text-center text-sm text-muted-foreground shadow-card">
            Set a monthly cap for groceries, rent, or anything else you want to watch.
          </p>
        ) : (
          rows.map((b) => {
            const Icon = b.cat.icon;
            return (
              <article key={b.id} className="rounded-xl bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4" strokeWidth={1.75} />
                    </span>
                    <div>
                      <h2 className="text-sm font-medium">{b.cat.name}</h2>
                      <p className="text-[12px] text-muted-foreground">
                        {money(b.spent, currency)} of {money(b.amount, currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-[12px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setCat(b.categoryId);
                        setAmt(String(b.amount));
                        setOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-[12px] text-muted-foreground hover:text-destructive"
                      onClick={() => removeBudget(b.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <Progress
                  className="mt-4"
                  value={b.ratio * 100}
                  indicatorClassName={b.ratio >= 1 ? "bg-expense" : b.ratio >= 0.8 ? "bg-chart-5" : "bg-income"}
                />
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {pct(Math.min(b.ratio, 2) * 100)} used
                  {b.ratio < 1 ? ` · ${money(b.amount - b.spent, currency)} left` : " · over"}
                </p>
              </article>
            );
          })
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Monthly budget</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(amt);
              if (!n || n <= 0) return toast.error("Enter an amount");
              upsertBudget(cat, n);
              setOpen(false);
              toast.success("Budget saved");
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriesFor("expense").map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount</Label>
              <Input value={amt} inputMode="decimal" onChange={(e) => setAmt(e.target.value)} />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Mini({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-xl bg-card p-4 shadow-card ${className ?? ""}`}>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-xl tabular-nums whitespace-nowrap sm:text-2xl">{value}</p>
    </div>
  );
}
