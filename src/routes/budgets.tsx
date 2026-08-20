import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES, categoriesFor, getCategory } from "@/lib/categories";
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
  const bills = useFinanceStore((s) => s.bills);
  const upsertBudget = useFinanceStore((s) => s.upsertBudget);
  const removeBudget = useFinanceStore((s) => s.removeBudget);
  const upsertBill = useFinanceStore((s) => s.upsertBill);
  const removeBill = useFinanceStore((s) => s.removeBill);
  const currency = useFinanceStore((s) => s.settings.currency);
  const [open, setOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [cat, setCat] = useState("groceries");
  const [amt, setAmt] = useState("500");
  const [bill, setBill] = useState({ name: "", amount: "", day: "1", categoryId: "utilities" });

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
          <p className="text-[13px] text-muted-foreground">Caps and repeating bills</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Budgets</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBillOpen(true)}>
            Add bill
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
                  <button
                    type="button"
                    className="text-[12px] text-muted-foreground hover:text-destructive"
                    onClick={() => removeBudget(b.id)}
                  >
                    Remove
                  </button>
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

      <section>
        <h2 className="mb-3 font-display text-2xl tracking-tight">Bills</h2>
        <div className="space-y-2">
          {bills.length === 0 ? (
            <p className="rounded-xl bg-card px-5 py-10 text-center text-sm text-muted-foreground shadow-card">
              Track rent, fibre, and subscriptions. Notices fire a few days before they are due.
            </p>
          ) : (
            bills.map((billRow) => (
              <article key={billRow.id} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-card">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{billRow.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {getCategory(billRow.categoryId).name} · day {billRow.dayOfMonth} · {money(billRow.amount, currency)}
                  </p>
                </div>
                <Switch
                  checked={billRow.enabled}
                  onCheckedChange={(enabled) => upsertBill({ ...billRow, enabled })}
                />
                <button
                  type="button"
                  className="text-[12px] text-muted-foreground hover:text-destructive"
                  onClick={() => removeBill(billRow.id)}
                >
                  Remove
                </button>
              </article>
            ))
          )}
        </div>
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

      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Recurring bill</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(bill.amount);
              const day = Number(bill.day);
              if (!bill.name.trim() || !n) return toast.error("Name and amount are required");
              upsertBill({
                name: bill.name.trim(),
                amount: n,
                dayOfMonth: Math.min(28, Math.max(1, day || 1)),
                categoryId: bill.categoryId,
                enabled: true,
              });
              setBillOpen(false);
              setBill({ name: "", amount: "", day: "1", categoryId: "utilities" });
              toast.success("Bill saved");
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={bill.name} onChange={(e) => setBill({ ...bill, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Amount</Label>
                <Input value={bill.amount} inputMode="decimal" onChange={(e) => setBill({ ...bill, amount: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Day of month</Label>
                <Input value={bill.day} inputMode="numeric" onChange={(e) => setBill({ ...bill, day: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={bill.categoryId} onValueChange={(categoryId) => setBill({ ...bill, categoryId })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.type === "expense").map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
